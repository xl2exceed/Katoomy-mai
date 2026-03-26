// lib/cron.ts
// Development-only background job to process scheduled SMS messages
// This runs every minute while your dev server is running

if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
  let intervalId: NodeJS.Timeout;

  const startCron = () => {
    console.log('🔔 Starting SMS cron job (development mode)');
    console.log('⏰ Will check for scheduled messages every 60 seconds');
    
    // Run immediately on start
    processScheduledMessages();
    
    // Then run every minute
    intervalId = setInterval(processScheduledMessages, 60000);
  };

  async function processScheduledMessages() {
    try {
      const response = await fetch('http://localhost:3000/api/sms/run-due');
      
      if (!response.ok) {
        console.error('❌ SMS Cron failed:', response.status, response.statusText);
        return;
      }
      
      const data = await response.json();
      
      if (data.processed > 0) {
        console.log(`✅ SMS Cron: Processed ${data.processed} messages (${data.sent} sent, ${data.failed} failed)`);
      } else {
        console.log('⏭️  SMS Cron: No messages due');
      }
    } catch (error) {
      console.error('❌ SMS Cron error:', error);
    }
  }

  // Cleanup on process exit
  process.on('exit', () => {
    if (intervalId) {
      console.log('🛑 Stopping SMS cron job');
      clearInterval(intervalId);
    }
  });

  startCron();
}

export {};
