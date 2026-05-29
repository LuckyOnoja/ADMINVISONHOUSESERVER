import prisma from "../db";
import { sendDayBeforeReminder, sendHourBeforeReminder } from "./email.service";

/**
 * Gets the current time broken down into parts for the 'Africa/Lagos' timezone (Nigeria, UTC+1).
 * Nigeria remains permanently on UTC+1 (WAT) without daylight saving adjustments.
 */
function getNigerianTimeParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  parts.forEach(p => {
    map[p.type] = p.value;
  });

  const year = parseInt(map.year);
  const month = parseInt(map.month);
  const day = parseInt(map.day);
  const hour = parseInt(map.hour);
  const minute = parseInt(map.minute);
  
  // Format date string YYYY-MM-DD
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  
  return {
    year,
    month,
    day,
    hour,
    minute,
    dateStr,
    timestamp: now.getTime()
  };
}

/**
 * Returns tomorrow's date string YYYY-MM-DD in 'Africa/Lagos' time.
 */
function getNigerianTomorrowDateStr(todayParts: { year: number, month: number, day: number }) {
  const todayInLagos = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
  // Add exactly 1 day (24 hours) in milliseconds
  const tomorrowInLagos = new Date(todayInLagos.getTime() + 24 * 60 * 60 * 1000);
  
  const year = tomorrowInLagos.getUTCFullYear();
  const month = tomorrowInLagos.getUTCMonth() + 1;
  const day = tomorrowInLagos.getUTCDate();
  
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Performs a single check across the database to process eligible reminder emails.
 */
export async function checkAndSendReminders() {
  const nigerianTime = getNigerianTimeParts();
  const tomorrowDateStr = getNigerianTomorrowDateStr(nigerianTime);

  // console.log(`⏰ [Scheduler Check] Nigerian Date: ${nigerianTime.dateStr}, Hour: ${nigerianTime.hour}, Tomorrow: ${tomorrowDateStr}`);

  try {
    // 1. EVENING-BEFORE REMINDER EMAIL (Sent the evening before the session, starting at 18:00 WAT)
    if (nigerianTime.hour >= 18) {
      // Find confirmed bookings for tomorrow that haven't received their day-before email
      const upcomingTomorrowBookings = await prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          bookingDate: tomorrowDateStr,
          dayBeforeEmailSent: false
        }
      });

      for (const booking of upcomingTomorrowBookings) {
        console.log(`⏰ Sending evening-before reminder to ${booking.customerEmail} for session ${booking.sessionId}`);
        try {
          await sendDayBeforeReminder(booking);
          await prisma.booking.update({
            where: { id: booking.id },
            data: { dayBeforeEmailSent: true }
          });
        } catch (err) {
          console.error(`❌ Failed to send day-before email for booking ID ${booking.id}:`, err);
        }
      }
    }

    // 2. 1-HOUR-BEFORE REMINDER EMAIL (Sent 1 hour before session start time)
    // Find all confirmed bookings that have not yet sent the 1-hour reminder
    const pendingHourBookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        hourBeforeEmailSent: false
      }
    });

    const nowTimestamp = Date.now();

    for (const booking of pendingHourBookings) {
      // Construct exact start time of the booking in Africa/Lagos timezone (UTC+1)
      const bookingStartStr = `${booking.bookingDate}T${booking.startTime}:00+01:00`;
      const bookingStartTimeMs = new Date(bookingStartStr).getTime();

      if (isNaN(bookingStartTimeMs)) {
        console.error(`❌ Invalid date/time format for booking ID ${booking.id}: ${bookingStartStr}`);
        continue;
      }

      const diffMs = bookingStartTimeMs - nowTimestamp;
      const diffMins = diffMs / (60 * 1000);

      // Check if session starts within the next 65 minutes (allowing buffer for scheduler intervals)
      // and has not started yet (diffMins > 0)
      if (diffMins <= 65 && diffMins > 0) {
        console.log(`⏰ Sending 1-hour-before reminder to ${booking.customerEmail} for session ${booking.sessionId} (starts in ${Math.round(diffMins)} mins)`);
        try {
          await sendHourBeforeReminder(booking);
          await prisma.booking.update({
            where: { id: booking.id },
            data: { hourBeforeEmailSent: true }
          });
        } catch (err) {
          console.error(`❌ Failed to send 1-hour email for booking ID ${booking.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("❌ Scheduler runtime error:", error);
  }
}

/**
 * Initializes the background reminder check loop.
 * Runs once every 5 minutes.
 */
export function startReminderScheduler() {
  console.log("⏰ Automated email reminder scheduler initialized (5-minute interval).");
  
  // Run once immediately on start
  checkAndSendReminders().catch(err => {
    console.error("❌ Initial scheduler check failed:", err);
  });

  // Set interval (5 minutes = 300,000 ms)
  setInterval(() => {
    checkAndSendReminders().catch(err => {
      console.error("❌ Interval scheduler check failed:", err);
    });
  }, 5 * 60 * 1000);
}
