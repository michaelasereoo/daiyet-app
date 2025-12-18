/**
 * Test Payment Flow Script
 * Run this in Node.js or browser console to test the meal plan purchase flow
 * 
 * Usage in browser console:
 * 1. Copy this entire file
 * 2. Paste in browser console on http://localhost:3000/user-dashboard/meal-plan
 * 3. Run: testMealPlanPurchase()
 */

async function testMealPlanPurchase() {
  console.log("🧪 Starting meal plan purchase test...\n");

  // Step 1: Simulate purchase selection
  const testPurchase = {
    packageId: "test",
    packageName: "Test Meal Plan",
    price: 100,
    currency: "NGN",
    dietitianId: "b900e502-71a6-45da-bde6-7b596cc14d88", // Dietitian UUID for michaelasereoo@gmail.com
    dietitianName: "Test Dietitian",
  };

  console.log("📦 Step 1: Storing purchase in localStorage");
  localStorage.setItem("pendingMealPlanPurchase", JSON.stringify(testPurchase));
  console.log("✅ Purchase stored:", testPurchase);

  // Step 2: Test payment initialization
  console.log("\n💳 Step 2: Testing payment initialization");
  try {
    const initResponse = await fetch("/api/paystack/initialize", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: testPurchase.price * 100, // Convert to kobo
        metadata: {
          requestType: "MEAL_PLAN",
          packageName: testPurchase.packageName,
          dietitianId: testPurchase.dietitianId,
        },
      }),
    });

    const initData = await initResponse.json();
    console.log("Init response status:", initResponse.status);
    console.log("Init response data:", initData);

    if (initResponse.ok && initData.authorization_url) {
      console.log("✅ Payment initialized successfully");
      console.log("🔗 Authorization URL:", initData.authorization_url);
      console.log("📝 Reference:", initData.reference);
      
      // Step 3: Check if payment record was created
      console.log("\n💾 Step 3: Checking payment record in database");
      // Note: We can't directly query the database from browser, but we can check via API
      
      // Step 4: Simulate callback (without actually redirecting)
      console.log("\n🔄 Step 4: Simulating callback redirect");
      const callbackUrl = new URL("/api/paystack/callback", window.location.origin);
      callbackUrl.searchParams.set("reference", initData.reference);
      console.log("Callback URL would be:", callbackUrl.toString());
      
      // Step 5: Test session request creation (simulate after payment)
      console.log("\n📝 Step 5: Testing session request creation");
      const sessionRequestResponse = await fetch("/api/user/session-requests", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dietitianId: testPurchase.dietitianId,
          requestType: "MEAL_PLAN",
          mealPlanType: testPurchase.packageName,
          notes: `Test Meal Plan Purchase: ${testPurchase.packageName}`,
          paymentData: { reference: initData.reference },
          price: testPurchase.price,
          currency: testPurchase.currency,
        }),
      });

      const sessionRequestData = await sessionRequestResponse.json();
      console.log("Session request response status:", sessionRequestResponse.status);
      console.log("Session request response data:", sessionRequestData);

      if (sessionRequestResponse.ok) {
        console.log("✅ Session request created successfully!");
        console.log("Request ID:", sessionRequestData.request?.id);
        
        // Step 6: Verify it appears in the list
        console.log("\n📋 Step 6: Verifying session request appears in list");
        const listResponse = await fetch("/api/user/session-requests", {
          credentials: "include",
        });
        const listData = await listResponse.json();
        console.log("Session requests count:", listData.requests?.length || 0);
        console.log("Session requests:", listData.requests);
        
        const testRequest = listData.requests?.find(
          (r) => r.id === sessionRequestData.request?.id
        );
        if (testRequest) {
          console.log("✅ Test request found in list!");
          console.log("Request details:", testRequest);
        } else {
          console.log("❌ Test request NOT found in list");
        }
      } else {
        console.error("❌ Failed to create session request:", sessionRequestData);
      }
    } else {
      console.error("❌ Payment initialization failed:", initData);
    }
  } catch (error) {
    console.error("❌ Error during test:", error);
  }

  console.log("\n🏁 Test completed!");
}

// Test callback redirect logic
async function testCallbackRedirect(reference) {
  console.log("🧪 Testing callback redirect logic...\n");
  console.log("Reference:", reference);

  try {
    // Simulate what the callback route does
    const response = await fetch(`/api/paystack/callback?reference=${reference}`, {
      method: "GET",
      credentials: "include",
      redirect: "manual", // Don't follow redirect
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    
    if (response.status === 307 || response.status === 308) {
      const location = response.headers.get("location");
      console.log("✅ Redirect location:", location);
      
      if (location?.includes("/user-dashboard/meal-plan")) {
        console.log("✅ Correctly redirects to meal-plan page!");
      } else {
        console.log("❌ Redirects to wrong page:", location);
      }
    } else {
      console.log("❌ No redirect found");
    }
  } catch (error) {
    console.error("❌ Error testing callback:", error);
  }
}

// Test payment verification
async function testPaymentVerification(reference) {
  console.log("🧪 Testing payment verification...\n");
  console.log("Reference:", reference);

  try {
    const response = await fetch("/api/payments/verify", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reference }),
    });

    const data = await response.json();
    console.log("Verification response status:", response.status);
    console.log("Verification response data:", data);

    if (response.ok) {
      console.log("✅ Payment verified successfully!");
    } else {
      console.error("❌ Payment verification failed:", data);
    }
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
  }
}

// Test full flow (simulate complete purchase)
async function testFullFlow() {
  console.log("🧪 Testing full meal plan purchase flow...\n");

  const testPurchase = {
    packageId: "test",
    packageName: "Test Meal Plan",
    price: 100,
    currency: "NGN",
    dietitianId: "b900e502-71a6-45da-bde6-7b596cc14d88", // Dietitian UUID for michaelasereoo@gmail.com
    dietitianName: "Test Dietitian",
  };

  // 1. Store purchase
  localStorage.setItem("pendingMealPlanPurchase", JSON.stringify(testPurchase));
  console.log("✅ Step 1: Purchase stored in localStorage");

  // 2. Initialize payment
  console.log("\n💳 Step 2: Initializing payment...");
  const initResponse = await fetch("/api/paystack/initialize", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: testPurchase.price * 100,
      metadata: { requestType: "MEAL_PLAN" },
    }),
  });

  const initData = await initResponse.json();
  if (!initResponse.ok) {
    console.error("❌ Payment init failed:", initData);
    return;
  }

  console.log("✅ Payment initialized, reference:", initData.reference);

  // 3. Simulate payment success (create session request directly)
  console.log("\n📝 Step 3: Creating session request...");
  const sessionResponse = await fetch("/api/user/session-requests", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dietitianId: testPurchase.dietitianId,
      requestType: "MEAL_PLAN",
      mealPlanType: testPurchase.packageName,
      notes: `Test: ${testPurchase.packageName}`,
      paymentData: { reference: initData.reference },
      price: testPurchase.price,
      currency: testPurchase.currency,
    }),
  });

  const sessionData = await sessionResponse.json();
  if (sessionResponse.ok) {
    console.log("✅ Session request created:", sessionData.request?.id);
    
    // 4. Verify it appears
    console.log("\n📋 Step 4: Verifying request appears...");
    const listResponse = await fetch("/api/user/session-requests", {
      credentials: "include",
    });
    const listData = await listResponse.json();
    const found = listData.requests?.find(r => r.id === sessionData.request?.id);
    
    if (found) {
      console.log("✅ Request found in pending list!");
      console.log("Request:", found);
    } else {
      console.log("❌ Request NOT found in list");
      console.log("All requests:", listData.requests);
    }
  } else {
    console.error("❌ Failed to create session request:", sessionData);
  }

  // Cleanup
  localStorage.removeItem("pendingMealPlanPurchase");
  console.log("\n🧹 Cleaned up localStorage");
}

// Export for use
if (typeof window !== "undefined") {
  window.testMealPlanPurchase = testMealPlanPurchase;
  window.testCallbackRedirect = testCallbackRedirect;
  window.testPaymentVerification = testPaymentVerification;
  window.testFullFlow = testFullFlow;
  
  console.log("✅ Test functions loaded! Use:");
  console.log("  - testMealPlanPurchase() - Full test");
  console.log("  - testFullFlow() - Simplified full flow");
  console.log("  - testCallbackRedirect('reference') - Test callback");
  console.log("  - testPaymentVerification('reference') - Test verification");
}

// For Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    testMealPlanPurchase,
    testCallbackRedirect,
    testPaymentVerification,
    testFullFlow,
  };
}

