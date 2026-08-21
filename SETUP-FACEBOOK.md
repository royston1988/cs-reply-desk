# Connecting the Reply Desk to Facebook

Everything on our side is built. The only missing piece is a **key** from
Facebook that lets our app read the page's messages.

Page we are connecting: **AC - Ample Couture** (ID `303915139678621`)

---

## Do this first — the 10-minute test

This gets a temporary key so we can prove reading works. It expires after
about an hour, which is fine — we only want to know whether Facebook says yes.

1. Open **https://developers.facebook.com/tools/explorer**
   (log in with the Facebook account that manages the AC page)
2. Top right, under **Meta App**, pick any existing app.
   If there's no app, click *Create App* → choose **Business** → name it
   `AC Reply Desk`.
3. Click the **Permissions** box and tick these three:
   - `pages_messaging`
   - `pages_read_engagement`
   - `pages_show_list`
4. Click **Generate Access Token** → choose **AC - Ample Couture** when it asks
   which page.
5. Copy the long string of letters it gives you.

### Where to put it

1. In the folder `C:\Users\roysr\CS Reply system`, find the file
   **`.env.local.example`**
2. Make a copy of it and rename the copy to **`.env.local`**
3. Open it in Notepad and paste the key after `FB_PAGE_TOKEN=`
4. Save, then restart the app

**Do not paste the key into a chat window.** It's a password for your page.

---

## If the test works — make it permanent

The temporary key dies in an hour. For daily use we need a **System User**
token, which never expires.

1. Go to **https://business.facebook.com/settings**
2. Left menu → **Users** → **System users** → **Add**
   - Name: `AC Reply Desk`
   - Role: **Admin**
3. Click **Assign assets** → **Pages** → tick **AC - Ample Couture**
   → turn on **Manage Page** → Save
4. Click **Generate new token**
   - App: the same app from the test
   - Permissions: `pages_messaging`, `pages_read_engagement`
   - Expiry: **Never**
5. Copy that key into `.env.local` the same way, replacing the temporary one.

---

## What "connected" looks like

Open the app. Top right corner:

| What you see | Meaning |
|---|---|
| 🟡 **Sample messages — Facebook not connected** | No key yet, showing fake customers |
| 🟢 **Live from Facebook** | Working — those are real customers |

---

## What appears once connected

**Real:** customer names, their actual messages, how long they've been
waiting, and who still needs a reply. The list sorts longest-wait first.

**Still missing, on purpose:** the AI-written reply and the order details.
Those are the next two steps — one needs the AI trained on your past replies,
the other needs Shopline.

---

## If Facebook says no

The most likely message is about **permissions** or **App Review**. That is not
a dead end — it means the app needs `pages_messaging` approved, which is a form
Meta reviews. Tommy (ex-Meta) or Desmond can handle it.

Send me whatever error message you see and I'll tell you exactly what it means.
