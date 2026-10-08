const base = 'https://instachat07.netlify.app';

async function testAll() {
  const ts = Date.now();
  console.log('1. Testing User A signup...');
  const aRes = await (await fetch(base + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user_a_' + ts, email: 'usera_' + ts + '@test.com', password: 'password123' })
  })).json();
  console.log('User A:', aRes.user?.username, aRes.user?.userId);

  console.log('2. Testing User B signup...');
  const bRes = await (await fetch(base + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user_b_' + ts, email: 'userb_' + ts + '@test.com', password: 'password123' })
  })).json();
  console.log('User B:', bRes.user?.username, bRes.user?.userId);

  console.log('3. User A searches for User B...');
  const searchRes = await (await fetch(base + '/api/friends/search?q=user_b_' + ts + '&currentUserId=' + aRes.user?.userId)).json();
  console.log('Search found:', searchRes.users?.length, searchRes.users?.map(u => u.username));

  console.log('4. User A sends friend request to User B...');
  const reqRes = await (await fetch(base + '/api/friends/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderUser: aRes.user, receiverUser: bRes.user })
  })).json();
  console.log('Request response:', reqRes);

  console.log('5. User B fetches pending requests...');
  const bRequests = await (await fetch(base + '/api/friends/' + bRes.user?.userId + '/requests')).json();
  console.log('User B incoming requests count:', bRequests.incoming?.length);
  console.log('User B incoming requests:', JSON.stringify(bRequests.incoming));

  if (bRequests.incoming?.length > 0) {
    console.log('6. User B accepts friend request...');
    const acceptRes = await (await fetch(base + '/api/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: bRequests.incoming[0].requestId, currentUserId: bRes.user.userId })
    })).json();
    console.log('Accept result:', acceptRes);

    console.log('7. Verify friends list for User A and B...');
    const aFriends = await (await fetch(base + '/api/friends/' + aRes.user.userId)).json();
    const bFriends = await (await fetch(base + '/api/friends/' + bRes.user.userId)).json();
    console.log('User A friends:', aFriends.friends?.map(f => f.friendUsername));
    console.log('User B friends:', bFriends.friends?.map(f => f.friendUsername));
  }
}

testAll().catch(console.error);
