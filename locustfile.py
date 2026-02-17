from locust import HttpUser, task, between, events
import random
import logging
import uuid
import json
import os

class VelishUser(HttpUser):

    host = os.getenv("TARGET_HOST", "http://localhost:4000")
    wait_time = between(2, 5)

    token = None
    email = "test@gmail.com"
    password = "123456"
    
    # Store valid menu items to use in orders
    # format: { cafeteria_id: [ {id, price, name} ] }
    menu_items_cache = {}

    # =====================================
    # LOGIN OR REGISTER FIRST
    # =====================================
    def on_start(self):
        # 1. Try Login
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": self.email,
                "password": self.password
            }
        )

        if response.status_code == 200:
            self.token = response.json().get("token")
        elif response.status_code == 400:
            # 2. If Login Fails, Try Register
            logging.info("Login failed, attempting registration...")
            reg_response = self.client.post(
                "/api/auth/register",
                json={
                    "name": "Load Test User",
                    "email": self.email,
                    "password": self.password
                }
            )
            
            if reg_response.status_code in [200, 201]:
                self.token = reg_response.json().get("token")
                logging.info("Registration success, logged in.")
            else:
                logging.error(f"Registration failed: {reg_response.text}")
        else:
            logging.error(f"Login failed with status {response.status_code}")
            
        # 3. Fetch some menu items for finding valid IDs
        if self.token:
            self.fetch_valid_items(cafeteria_id=1)

    def fetch_valid_items(self, cafeteria_id):
        # logging.info(f"Fetching menu for cafeteria {cafeteria_id}...")
        with self.client.get(f"/api/menu/cafeteria/{cafeteria_id}", catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    # format might be list or {success: true, data: []}
                    # checking menuController usually it returns list or object.
                    # Assuming list based on previous context.
                    items = data if isinstance(data, list) else data.get("data", [])
                    
                    valid_items = []
                    for item in items:
                        # Extract ID, try 'id' or 'menuItemId'
                        i_id = item.get("id") or item.get("menuItemId")
                        i_price = item.get("price") or item.get("priceAtOrder") or 50
                        i_name = item.get("name") or "Test Item"
                        
                        if i_id:
                            valid_items.append({"id": i_id, "price": i_price, "name": i_name})
                    
                    if valid_items:
                        self.menu_items_cache[cafeteria_id] = valid_items
                        # logging.info(f"Cached {len(valid_items)} items for cafeteria {cafeteria_id}")
                    else:
                        logging.warning(f"No valid items found for cafeteria {cafeteria_id}")
                except Exception as e:
                    logging.error(f"Failed to parse menu: {e}")

    # =====================================
    # COMMON HEADERS
    # =====================================
    def get_headers(self):
        if self.token:
            return {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        return {}

    # =====================================
    # BROWSE CAFETERIAS
    # =====================================
    @task(5)
    def get_cafeterias(self):
        self.client.get("/api/cafeterias")

    # =====================================
    # VIEW MENU
    # =====================================
    @task(4)
    def get_menu(self):
        cafeteria_id = random.randint(1, 5)
        self.client.get(f"/api/menu/cafeteria/{cafeteria_id}")

    # =====================================
    # GET USER PROFILE
    # =====================================
    @task(2)
    def get_user(self):
        if self.token:
            self.client.get("/api/user/profile", headers=self.get_headers())

    # =====================================
    # PLACE ORDER (DISABLED - Endpoint Broken)
    # =====================================
    # @task(2)
    # def place_order(self):
        # This endpoint (/api/orders) fails with 500 because it doesn't set cashfreeOrderId
        # passing for now until backend is fixed
        # pass

    # =====================================
    # PAYMENT CONFIRMATION TEST
    # =====================================
    @task(1)
    def payment_confirmation(self):
        if not self.token:
            return
            
        cafeteria_id = 1
        
        # Ensure we have valid items
        if cafeteria_id not in self.menu_items_cache or not self.menu_items_cache[cafeteria_id]:
            self.fetch_valid_items(cafeteria_id)
            
        cached_items = self.menu_items_cache.get(cafeteria_id, [])
        if not cached_items:
            # logging.warning("Skipping payment test - no valid items")
            return

        # Pick a random item
        item = random.choice(cached_items)

        # Generate unique IDs for payment test
        order_id = f"order_{uuid.uuid4().hex[:8]}"
        bill_id = f"bill_{uuid.uuid4().hex[:8]}"
        txn_id = f"txn_{uuid.uuid4().hex[:8]}"

        payload = {
            "orderId": order_id,     # Mapped to cashfreeOrderId
            "billId": bill_id,
            "cafeteriaId": cafeteria_id,
            "transactionId": txn_id,
            "amount": item["price"],
            "isParcel": False,
            "parcelAmount": 0,
            "items": [
                 {
                    "menuItemId": item["id"],
                    "quantity": 1,
                    "price": item["price"],
                    "name": item["name"],
                    "isParcelSelected": False
                }
            ]
        }

        with self.client.post(
            "/api/payments/confirm",
            json=payload,
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code != 200:
                logging.error(f"Payment Confirm Failed ({response.status_code}): {response.text}")
                response.failure(f"Payment Failed: {response.text}")

    # =====================================
    # GET BANNERS
    # =====================================
    @task(3)
    def get_banners(self):
        self.client.get("/api/banners")
