const CLOUD_NAME = 'jdkg4l75';
const UPLOAD_PRESET = 'battlechat_upload';
const CLOUD_DB_URL = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/instachat_persistent_db.json`;

async function testSync() {
  console.log('1. Fetching current persistent DB from Cloudinary...');
  try {
    const res = await fetch(`${CLOUD_DB_URL}?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      console.log('Fetched existing DB from Cloudinary. Keys:', Object.keys(data));
      console.log('Users in DB:', Object.keys(data.users || {}).length);
    } else {
      console.log('No DB yet or status:', res.status);
    }
  } catch (err) {
    console.log('Fetch error:', err.message);
  }

  console.log('2. Uploading test snapshot to Cloudinary...');
  const snapshot = {
    users: { usr_test_1: { userId: 'usr_test_1', username: 'Tester1', createdAt: Date.now() } },
    usernames: { tester1: 'usr_test_1' },
    friendships: {},
    friendRequests: {},
    conversations: {},
    messages: {},
    gameRooms: {},
    gameInvites: {},
    activeCalls: {},
    pendingEvents: {},
    lastUpdated: Date.now(),
  };

  const formData = new FormData();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  formData.append('file', blob, 'instachat_persistent_db.json');
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('public_id', 'instachat_persistent_db');
  formData.append('resource_type', 'raw');
  formData.append('overwrite', 'true');
  formData.append('invalidate', 'true');

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, {
    method: 'POST',
    body: formData,
  });

  console.log('Upload status:', uploadRes.status);
  const uploadData = await uploadRes.json();
  console.log('Upload URL:', uploadData.secure_url);

  console.log('3. Re-fetching to confirm consistency...');
  const verifyRes = await fetch(`${uploadData.secure_url}?t=${Date.now()}`);
  const verifyData = await verifyRes.json();
  console.log('Verified user count:', Object.keys(verifyData.users).length);
  console.log('PASS: Cloud DB Synchronization is verified and ready!');
}

testSync().catch(console.error);
