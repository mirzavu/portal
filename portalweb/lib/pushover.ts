// Pushover notification service
interface PushoverMessage {
  message: string;
  title?: string;
  priority?: -2 | -1 | 0 | 1 | 2;
  sound?: string;
}

export async function sendPushoverNotification(data: PushoverMessage) {
  const userKey = process.env.PUSHOVER_USER_KEY;
  const apiToken = process.env.PUSHOVER_API_TOKEN;

  if (!userKey || !apiToken) {
    console.warn('Pushover credentials not set. Skipping notification.');
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('token', apiToken);
    formData.append('user', userKey);
    formData.append('message', data.message);
    
    if (data.title) formData.append('title', data.title);
    if (data.priority !== undefined) formData.append('priority', data.priority.toString());
    if (data.sound) formData.append('sound', data.sound);

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Pushover API error:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Pushover notification:', error);
    return false;
  }
}






