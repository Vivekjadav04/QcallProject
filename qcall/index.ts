import { AppRegistry, Linking, Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidCategory, AndroidLaunchActivityFlag } from '@notifee/react-native';
import "expo-router/entry";
import { SpamService } from './services/SpamService'; 

const CallHeadlessTask = async (data: { number: string }) => {
  console.log('📞 [QCall Brain] Background Call Detected:', data.number);

  let callerName = "Identifying...";
  let isSpamCall = false;

  try {
    if (data.number) {
      const info = await SpamService.identifyNumber(data.number);
      callerName = info.name;
      isSpamCall = info.isSpam;
    }
  } catch (e) {
    console.error("[QCall Brain] Intelligence service failed:", e);
  }

  const deepLinkUrl = `qcall://incoming?number=${data.number}&name=${encodeURIComponent(callerName)}&isSpam=${isSpamCall}`;

  // 🚀 FIXED INVOKING LOGIC
  try {
    // Attempt to open the app directly. 
    // This requires "Display over other apps" and "Battery Optimization" to be off.
    await Linking.openURL(deepLinkUrl);
  } catch (err) {
    console.log("⚠️ Fallback to Full Screen Intent...");

    await notifee.displayNotification({
      id: 'incoming_call',
      title: isSpamCall ? '⚠️ SPAM ALERT' : 'Incoming Call',
      body: `Call from ${callerName}`,
      android: {
        channelId: 'incoming_calls',
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        ongoing: true, // Prevents the user from swiping it away
        autoCancel: false, 
        // 🟢 FIX: This triggers the "Invoking" behavior (Full Screen Intent)
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        // 🟢 FIX: Ensure pressing the notification opens the app rather than closing it
        pressAction: {
          id: 'default',
          launchActivity: 'default',
          launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
        },
        actions: [
          {
            title: 'Answer',
            pressAction: { id: 'answer', launchActivity: 'default' },
          },
          {
            title: 'Decline',
            // 🟢 FIX: Handled by NotificationActionReceiver in background to prevent app close
            pressAction: { id: 'decline' }, 
          },
        ],
      },
      data: { url: deepLinkUrl }
    });
  }
};

AppRegistry.registerHeadlessTask('CallHeadlessTask', () => CallHeadlessTask);