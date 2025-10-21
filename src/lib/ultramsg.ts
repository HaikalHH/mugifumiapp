// Ultramsg utility functions for WhatsApp notifications

// WhatsApp API configuration
const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID || "instance146361";
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || "0dphdxuuhgdfhtja";
const ULTRAMSG_PHONES = process.env.ULTRAMSG_PHONES || "+6281275167471,+6281378471123,+6281276167733,+6281261122306";
const ULTRAMSG_BASE_URL = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}`;

// Parse phone numbers from comma-separated string (for reports)
const PHONE_NUMBERS = ULTRAMSG_PHONES.split(',').map(phone => phone.trim());

// Order notification phone numbers by region (from environment variables)
const ORDER_PHONE_NUMBERS = {
  Jakarta: process.env.ULTRAMSG_ORDER_PHONE_JAKARTA || "+628986723926",
  Bandung: process.env.ULTRAMSG_ORDER_PHONE_BANDUNG || "+6281320699662"
};

export interface OrderNotificationData {
  outlet: string;
  location: string;
  customer: string;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
}

export interface DeliveryNotificationData {
  outlet: string;
  location: string;
  customer: string;
  orderId: number;
  deliveryDate: string;
  ongkirPlan: number;
  ongkirActual: number;
  costDifference: number;
  costDifferencePercent: number;
  items: Array<{
    name: string;
    barcode: string;
    price: number;
  }>;
}

export async function sendWhatsAppMessage(message: string, phoneNumber: string): Promise<boolean> {
  try {
    const response = await fetch(`${ULTRAMSG_BASE_URL}/messages/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: ULTRAMSG_TOKEN,
        to: phoneNumber,
        body: message,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to send WhatsApp message to ${phoneNumber}:`, await response.text());
      return false;
    }

    const result = await response.json();
    console.log(`WhatsApp message sent successfully to ${phoneNumber}:`, result);
    return true;
  } catch (error) {
    console.error(`Error sending WhatsApp message to ${phoneNumber}:`, error);
    return false;
  }
}

export async function sendWhatsAppToMultipleNumbers(message: string): Promise<{ 
  total: number; 
  success: number; 
  failed: number; 
  results: Array<{ phone: string; success: boolean }> 
}> {
  const results = await Promise.all(
    PHONE_NUMBERS.map(async (phone) => {
      const success = await sendWhatsAppMessage(message, phone);
      return { phone, success };
    })
  );

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    total: PHONE_NUMBERS.length,
    success,
    failed,
    results
  };
}

export function formatOrderNotificationMessage(data: OrderNotificationData): string {
  const lines = data.items.map((item) => {
    return `- ${item.name} x${item.quantity} @ Rp ${item.price.toLocaleString("id-ID")} = Rp ${item.subtotal.toLocaleString("id-ID")}`;
  });

  const message = [
    "🛒 *Notifikasi Order Baru*",
    "",
    `🏪 *Outlet:* ${data.outlet}`,
    `📍 *Region:* ${data.location}`,
    `👤 *Customer:* ${data.customer}`,
    "",
    "📦 *Items:*",
    ...lines,
    "",
    `💰 *Total: Rp ${data.total.toLocaleString("id-ID")}*`,
    "",
    "⏰ " + new Date().toLocaleString("id-ID", { 
      timeZone: "Asia/Jakarta",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  ].join("\n");

  return message;
}

export function formatDeliveryNotificationMessage(data: DeliveryNotificationData): string {
  const lines = data.items.map((item) => {
    return `- ${item.name} (${item.barcode}) @ Rp ${item.price.toLocaleString("id-ID")}`;
  });

  const costDifferenceText = data.costDifference > 0 
    ? `📈 Lebih mahal Rp ${Math.abs(data.costDifference).toLocaleString("id-ID")} (${data.costDifferencePercent.toFixed(1)}%)`
    : data.costDifference < 0 
    ? `📉 Lebih murah Rp ${Math.abs(data.costDifference).toLocaleString("id-ID")} (${Math.abs(data.costDifferencePercent).toFixed(1)}%)`
    : `✅ Sesuai rencana`;

  const message = [
    "🚚 *Notifikasi Delivery Selesai*",
    "",
    `🏪 *Outlet:* ${data.outlet}`,
    `📍 *Region:* ${data.location}`,
    `👤 *Customer:* ${data.customer}`,
    `📦 *Order ID:* #${data.orderId}`,
    `📅 *Delivery Date:* ${new Date(data.deliveryDate).toLocaleDateString("id-ID")}`,
    "",
    "💰 *Ongkir Details:*",
    `📋 *Plan:* Rp ${data.ongkirPlan.toLocaleString("id-ID")}`,
    `✅ *Actual:* Rp ${data.ongkirActual.toLocaleString("id-ID")}`,
    `📊 *Selisih:* ${costDifferenceText}`,
    "",
    "📦 *Items Delivered:*",
    ...lines,
    "",
    "⏰ " + new Date().toLocaleString("id-ID", { 
      timeZone: "Asia/Jakarta",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  ].join("\n");

  return message;
}

export async function sendOrderNotification(data: OrderNotificationData): Promise<{ 
  success: boolean; 
  message: string; 
  results?: Array<{ phone: string; success: boolean }> 
}> {
  try {
    const message = formatOrderNotificationMessage(data);
    
    // Get phone number based on location
    const phoneNumber = ORDER_PHONE_NUMBERS[data.location as keyof typeof ORDER_PHONE_NUMBERS];
    
    if (!phoneNumber) {
      return {
        success: false,
        message: `No phone number configured for location: ${data.location}`
      };
    }

    // Send to specific region phone number
    const success = await sendWhatsAppMessage(message, phoneNumber);

    if (!success) {
      return {
        success: false,
        message: `Failed to send WhatsApp notification to ${phoneNumber}`
      };
    }

    return {
      success: true,
      message: `Order notification sent successfully to ${phoneNumber} (${data.location})`,
      results: [{ phone: phoneNumber, success: true }]
    };
  } catch (error) {
    console.error("Error sending order notification:", error);
    return {
      success: false,
      message: "Error sending order notification"
    };
  }
}

export async function sendDeliveryNotification(data: DeliveryNotificationData): Promise<{ 
  success: boolean; 
  message: string; 
  results?: Array<{ phone: string; success: boolean }> 
}> {
  try {
    const message = formatDeliveryNotificationMessage(data);
    
    // Get phone number based on location
    const phoneNumber = ORDER_PHONE_NUMBERS[data.location as keyof typeof ORDER_PHONE_NUMBERS];
    
    if (!phoneNumber) {
      return {
        success: false,
        message: `No phone number configured for location: ${data.location}`
      };
    }

    // Send to specific region phone number
    const success = await sendWhatsAppMessage(message, phoneNumber);

    if (!success) {
      return {
        success: false,
        message: `Failed to send WhatsApp notification to ${phoneNumber}`
      };
    }

    return {
      success: true,
      message: `Delivery notification sent successfully to ${phoneNumber} (${data.location})`,
      results: [{ phone: phoneNumber, success: true }]
    };
  } catch (error) {
    console.error("Error sending delivery notification:", error);
    return {
      success: false,
      message: "Error sending delivery notification"
    };
  }
}
