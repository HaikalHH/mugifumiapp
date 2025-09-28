// Reset Prisma connection script
// Run this with: node reset_prisma.js

const { PrismaClient } = require('@prisma/client');

async function resetConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test if new tables exist
    const orderCount = await prisma.order.count();
    console.log(`✅ Order table exists, count: ${orderCount}`);
    
    const deliveryCount = await prisma.delivery.count();
    console.log(`✅ Delivery table exists, count: ${deliveryCount}`);
    
    // Test a simple query
    const products = await prisma.product.findMany({ take: 1 });
    console.log(`✅ Product query successful, found ${products.length} products`);
    
    console.log('🎉 All tests passed! Database is ready.');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetConnection();
