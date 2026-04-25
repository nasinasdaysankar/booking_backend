
import axios from 'axios';

const testPayment = async () => {
  try {
    const response = await axios.post('http://localhost:4000/api/payments/create', {
      orderAmount: 1.0,
      orderCurrency: "INR",
      orderId: "TEST_" + Date.now(),
      cafeteriaId: 3,
      items: [{ id: 1, name: "Test Item", qty: 1, price: 1.0 }],
      customerDetails: {
        customerId: "test_user",
        customerPhone: "9999999999",
        customerEmail: "test@example.com",
        customerName: "Test User"
      },
      orderMeta: {
        returnUrl: "cashfreeapp://callback"
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Assuming no auth required for this endpoint or using a test token
        // If it requires a user token, we might need to grab one from logs
      }
    });

    console.log("Response Status:", response.status);
    console.log("Response Data:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
};

testPayment();
