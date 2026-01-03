#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orderId = Number(process.argv[2]);
  const targetGoodsTotal = process.argv[3] ? Number(process.argv[3]) : null;

  if (!orderId || Number.isNaN(orderId)) {
    console.error("Usage: node scripts/fix-order-prices.mjs <orderId> [targetGoodsTotal]");
    process.exit(1);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      deliveries: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const deliveryPriceMap = new Map();
  for (const delivery of order.deliveries) {
    for (const item of delivery.items) {
      if (!deliveryPriceMap.has(item.productId)) {
        deliveryPriceMap.set(item.productId, { qty: 0, sum: 0 });
      }
      const stats = deliveryPriceMap.get(item.productId);
      stats.qty += 1;
      stats.sum += item.price;
    }
  }

  const recalculated = [];
  let goodsTotal = 0;
  for (const item of order.items) {
    const stats = deliveryPriceMap.get(item.productId);
    const snapshotPrice =
      stats && stats.qty > 0 ? Math.round(stats.sum / stats.qty) : item.price;
    recalculated.push({ id: item.id, quantity: item.quantity, price: snapshotPrice });
    goodsTotal += snapshotPrice * item.quantity;
  }

  if (targetGoodsTotal && Number.isFinite(targetGoodsTotal)) {
    const diff = Math.round(targetGoodsTotal - goodsTotal);
    if (diff !== 0 && recalculated.length > 0) {
      const last = recalculated[recalculated.length - 1];
      const perItemAdjust = Math.round(diff / Math.max(1, last.quantity));
      recalculated[recalculated.length - 1] = {
        ...last,
        price: last.price + perItemAdjust,
      };
      goodsTotal = recalculated.reduce((sum, row) => sum + row.price * row.quantity, 0);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of recalculated) {
      await tx.orderItem.update({
        where: { id: row.id },
        data: { price: row.price },
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        totalAmount: goodsTotal + (order.ongkirPlan || 0),
      },
    });
  });

  console.log(
    `Order ${orderId} updated. Goods total: ${goodsTotal.toLocaleString("id-ID")}, new totalAmount including ongkirPlan: ${(goodsTotal + (order.ongkirPlan || 0)).toLocaleString("id-ID")}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

