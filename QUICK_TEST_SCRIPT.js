/**
 * Quick Test Script - Meal Plan Purchase Flow
 * 
 * Copy and paste this entire script into your browser console
 * on http://localhost:3000/user-dashboard/meal-plan
 * 
 * UUIDs:
 * - Dietitian: b900e502-71a6-45da-bde6-7b596cc14d88 (michaelasereoo@gmail.com)
 * - User: af000df5-8213-4765-815b-8c896456aaf8 (michaelasereo@gmail.com)
 */

(async function() {
  console.log("🧪 Testing meal plan purchase flow...\n");
  
  const testPurchase = {
    packageId: "test",
    packageName: "Test Meal Plan",
    price: 100,
    currency: "NGN",
    dietitianId: "b900e502-71a6-45da-bde6-7b596cc14d88", // Dietitian UUID
    dietitianName: "Michael (Dietitian)",
  };

  // Store in localStorage (simulating before redirect)
  localStorage.setItem("pendingMealPlanPurchase", JSON.stringify(testPurchase));
  console.log("✅ Step 1: Stored purchase in localStorage");
  console.log("   Purchase:", testPurchase);

  // Create session request directly
  console.log("\n📝 Step 2: Creating session request...");
  const response = await fetch("/api/user/session-requests", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dietitianId: testPurchase.dietitianId,
      requestType: "MEAL_PLAN",
      mealPlanType: testPurchase.packageName,
      notes: `Test Meal Plan Purchase: ${testPurchase.packageName}`,
      paymentData: { reference: "test_ref_" + Date.now() },
      price: testPurchase.price,
      currency: testPurchase.currency,
    }),
  });

  const data = await response.json();
  console.log("   Response status:", response.status);
  console.log("   Response data:", data);

  if (response.ok) {
    console.log("\n✅ Step 3: Session request created successfully!");
    console.log("   Request ID:", data.request?.id);
    
    // Check if it appears in the list
    console.log("\n📋 Step 4: Checking if it appears in pending list...");
    const listResponse = await fetch("/api/user/session-requests", {
      credentials: "include",
    });
    const listData = await listResponse.json();
    console.log("   Total requests found:", listData.requests?.length || 0);
    
    const found = listData.requests?.find(r => r.id === data.request?.id);
    if (found) {
      console.log("\n✅ SUCCESS! Request found in pending list!");
      console.log("   Request details:", found);
      console.log("\n🎉 Test passed! The request was created and is visible.");
    } else {
      console.log("\n❌ FAILED! Request NOT found in list");
      console.log("   All requests:", listData.requests);
      console.log("\n⚠️  The request was created but not showing up. Check:");
      console.log("   1. Email normalization");
      console.log("   2. RLS policies");
      console.log("   3. Status filter (should be PENDING)");
    }
  } else {
    console.error("\n❌ FAILED to create session request");
    console.error("   Error:", data.error || data.message);
    console.error("   Details:", data);
  }
  
  console.log("\n🏁 Test completed!");
})();

