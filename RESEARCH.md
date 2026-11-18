# King Legacy Event Tracker — Technical Research & Architecture Comparison

รายงานการศึกษาสถาปัตยกรรมและกลไกการทำงานของระบบ Event Tracker ในเกม **King Legacy** (แจ้งเตือน World Boss, Sea King, Hydra, ผลปีศาจ และ Event พิเศษผ่าน Discord) โดยเน้นเรื่องการระบุเซิร์ฟเวอร์ (`JobId`) และแนวทางการติดตามหลายเซิร์ฟเวอร์โดยไม่ต้องเปิด Roblox Client จำนวนมาก

---

## 1. กลไกพื้นฐานของ King Legacy (ทำไมต้องรู้ Server / JobId?)

* **Main Place ID:** `4520749081` (First Sea, Second Sea และ Third Sea ทำงานผ่านการย้ายโลกภายใน Universe เดียวกัน)
* **Per-Server Timer/State:** Event สำคัญในเกมทำงานแยกอิสระต่อเซิร์ฟเวอร์ ไม่ใช่ Global Timer:
  * **Sea King:** เกิดทุก 1 ชม. ใน Public Server (2 ชม. ใน Private Server) พร้อมข้อความแจ้งเตือนในเซิร์ฟเวอร์
  * **Ghost Ship (Second Sea):** เกิดทุก ~1 ชม. – 1 ชม. 40 นาที
  * **Hydra (Second Sea):** เกิด 1 ชม. หลังจากฆ่า Sea King ตัวที่ 3 ในเซิร์ฟเวอร์นั้นสำเร็จ
  * **Third Sea Events (Drakenfyr / Abyssal Tyrant):** สุ่มวนรอบทุก 1–2 ชม. (ตรวจสอบรอบได้ที่ Chalice บนเกาะ The Unearthly หรือข้อความแจ้งเตือนบนจอ)
  * **World Boss & Devil Fruit (Legacy Fruit):** World Boss มีคูลดาวน์ตายตัวต่อเซิร์ฟเวอร์ (เช่น 1–2.5 ชม.) ส่วนผลปีศาจเกิดตามธรรมชาติทุก 1–2 ชม. และหายภายใน 15 นาที

---

## 2. Event Tracker รู้ได้อย่างไรว่า Event เกิดในเซิร์ฟเวอร์ไหน?

1. **ข้อจำกัดของ Roblox Web API ภายนอก:**
   Endpoint สาธารณะ `https://games.roblox.com/v1/games/{placeId}/servers/Public` คืนค่าได้เพียง Metadata ของเซิร์ฟเวอร์ (`id` หรือ `JobId`, `playing`, `maxPlayers`, `ping`, `fps`) เท่านั้น **ไม่สามารถมองเห็นสถานะภายในเกมได้** เนื่องจากแต่ละเซิร์ฟเวอร์ของ Roblox เป็น Container ที่แยกขาดจากกัน
2. **การตรวจจับภายในเซิร์ฟเวอร์ (In-Game Client):**
   ต้องมี Client/สคริปต์อยู่ภายในเซิร์ฟเวอร์นั้นจริง เพื่อตรวจจับการเกิดของ Event (เช่น การตรวจสอบ Object ใน `Workspace`, ข้อความแจ้งเตือนบน UI/Chat หรือสถานะบอส) แล้วอ่านค่า `game.PlaceId` และ `game.JobId` ส่งออกไปยัง Backend API หรือ Discord Webhook
3. **การตามเข้าเซิร์ฟเวอร์ (Quick Join):**
   Discord Embed มักแนบ `JobId` หรือโค้ดสำหรับ Executor เพื่อเรียกใช้:
   ```lua
   game:GetService("TeleportService"):TeleportToPlaceInstance(placeId, jobId, game.Players.LocalPlayer)
   ```

---

## 3. แนวทางการติดตามหลายเซิร์ฟเวอร์ (โดยไม่ต้องเปิด Client จำนวนมาก)

### วิธีที่ 1: Crowdsourced Telemetry (ใช้ผู้เล่นจริงเป็น Node)
* **หลักการ:** ฝังระบบ Telemetry ไว้ในสคริปต์ Hub ที่มีผู้เล่นใช้งานอยู่ตามเซิร์ฟเวอร์ต่าง ๆ เมื่อผู้เล่นคนใดคนหนึ่งอยู่ในห้องที่ Event เกิด สคริปต์จะส่ง `JobId` + ข้อมูล Event ไปยัง Backend กลางเพื่อ Deduplicate แล้วแจ้งเตือนเข้า Discord
* **จุดเด่น:** เจ้าของระบบไม่ต้องเปิด Roblox Client เอง และครอบคลุมเซิร์ฟเวอร์ได้กว้างมาก

### วิธีที่ 2: Server-Hopper Bot (1–5 Client กระโดดสแกน)
* **หลักการ:** ใช้ Roblox Client จำนวนน้อย (1–5 จอ) ดึงรายชื่อ `JobId` จาก `games.roblox.com/v1/games/4520749081/servers/Public` แล้วใช้ `TeleportService:TeleportToPlaceInstance` คู่กับ `queue_on_teleport` วนกระโดดเข้าเซิร์ฟเวอร์ -> สแกนหา Event ที่กำลัง Active -> ส่งเข้า Discord -> กระโดดไปห้องถัดไป
* **ข้อจำกัด:** Endpoint `servers/Public` ติด Rate Limit (`HTTP 429`) ได้ง่าย (โดยเฉพาะจาก IP ของ Cloud/VPS) และ Pagination (`nextPageCursor`) มักจำกัดอยู่ราว ~700 เซิร์ฟเวอร์ รวมถึงตรวจจับได้เฉพาะ Event ที่เกิดค้างอยู่แล้วตอนบอทเข้าไป

### วิธีที่ 3: Headless / Low-Resource Multi-Instance (เปิดหลายจอแบบปิด Render)
* **หลักการ:** ข้าม Mutex `ROBLOX_singletonEvent` เพื่อรันหลาย Client พร้อมกัน ร่วมกับการปิดการเรนเดอร์ 3D (`RunService:Set3dRenderingEnabled(false)` ผ่านสิทธิ์ Executor), ใช้เครื่องมือแนว `rbxsilent` / `Roblox-Account-Manager` และปรับ FFlags / จำกัด FPS
* **ข้อจำกัด:** ลดภาระ GPU/CPU ได้มาก แต่ยังใช้ RAM ต่อ Process สูง และหากกด FPS ต่ำเกินไปอาจทำให้ Network Sync/Ping หน่วง

### วิธีที่ 4: Pure Protocol / RakNet Bot (ไม่เปิด Client)
* **หลักการ:** พยายามจำลอง Handshake ของ `gamejoin.roblox.com` และเชื่อมต่อ UDP/RakNet โดยตรงด้วยโค้ด
* **ความเป็นไปได้จริง:** ต่ำมาก ไม่แนะนำในระยะยาว เนื่องจาก Roblox เข้ารหัส RakNet, เปลี่ยน Serialization/Security Token บ่อย และมีระบบป้องกัน Hyperion (Byfron)

### วิธีที่ 5: External Web API Polling อย่างเดียว
* **หลักการ:** ดึงข้อมูลจาก `games.roblox.com/v1/games/{placeId}/servers/Public` ด้วย Python/Node.js
* **ความเป็นไปได้จริง:** ใช้ตรวจจับ Event ในเกมไม่ได้ (0%) ใช้ได้เพียงช่วยกรองรายชื่อ `JobId` ส่งต่อให้ Server-Hopper Bot

---

## 4. ตารางเปรียบเทียบ

| แนวทาง | ประสิทธิภาพ & ความเร็ว | ความแม่นยำ | การใช้ทรัพยากร | ความเป็นไปได้จริง |
| :--- | :--- | :--- | :--- | :--- |
| **1. Crowdsourced Telemetry** | สูงมาก (Real-time, ครอบคลุมกว้าง) | สูง (ต้องมี Deduplicate ฝั่ง Backend) | ต่ำมากฝั่งผู้ให้บริการ | สูงมาก (เฉพาะกรณีมีฐานผู้ใช้ Hub อยู่แล้ว) |
| **2. Server-Hopper Bot (1–5 จอ + ปิด Render)** | ปานกลาง–สูง | สูง (อ่านจากเกมจริง) | ต่ำ–ปานกลาง | **สูงที่สุดสำหรับสร้างระบบเอง** |
| **3. Multi-Instance เฝ้าห้อง (No-Render)** | Real-time เฉพาะห้องที่เฝ้า | สูงมาก | สูง (RAM ตามจำนวนจอ) | ปานกลาง (เหมาะกับ Private Server) |
| **4. Pure RakNet Protocol Bot** | เร็วในทฤษฎี | ไม่เสถียร | ต่ำมาก | ต่ำมาก (ติด Encryption / Hyperion) |
| **5. External Web API Polling** | N/A | 0% สำหรับ Event ในเกม | ต่ำมาก | ใช้ตรวจจับ Event ไม่ได้ |

---

## 5. สรุป

* **กรณีสร้างระบบติดตาม Public Server เอง (ไม่มีฐานผู้เล่น Hub):** แนวทางที่เหมาะสมที่สุดคือ **Hybrid: Server-Hopper Bot (1–5 Client) + ปิด Render (`Set3dRenderingEnabled(false)` / Low-FPS) + Web API Filter** เพราะสมดุลทั้งทรัพยากร ความแม่นยำ และความเป็นไปได้จริง
* **กรณีมีผู้ใช้งานสคริปต์กระจายตัวอยู่แล้ว:** **Crowdsourced Telemetry** เป็นวิธีที่คุ้มค่าและครอบคลุมที่สุด
