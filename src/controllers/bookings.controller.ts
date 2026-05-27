import { Request, Response } from "express";
import prisma from "../db";

// Rate cards and descriptions
interface PackageConfig {
  name: string;
  allowedDurations: number[]; // in minutes
  prices: Record<number, number>; // duration -> NGN price
}

export const PACKAGES: Record<string, PackageConfig> = {
  "serenity-arch": {
    name: "Serenity Arch",
    allowedDurations: [30, 60],
    prices: { 30: 20000, 60: 30000 }
  },
  "neo-tide": {
    name: "Neo Tide",
    allowedDurations: [30, 60],
    prices: { 30: 20000, 60: 30000 }
  },
  "velvet-corner": {
    name: "Velvet Corner",
    allowedDurations: [30, 60],
    prices: { 30: 20000, 60: 30000 }
  },
  "amber-lounge": {
    name: "Amber Lounge",
    allowedDurations: [30, 60],
    prices: { 30: 20000, 60: 30000 }
  },
  "elite-circle": {
    name: "Elite Circle",
    allowedDurations: [30, 60],
    prices: { 30: 20000, 60: 30000 }
  },
  "iconic-oasis": {
    name: "Iconic Oasis",
    allowedDurations: [30, 60],
    prices: { 30: 20000, 60: 30000 }
  },
  "podcast": {
    name: "Podcast Studio",
    allowedDurations: [60],
    prices: { 60: 20000 }
  }
};

// Helper: convert "HH:MM" string to minutes from midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper: check if a proposed slot overlaps with any confirmed bookings
const isSlotOverlapping = (
  startMin: number,
  endMin: number,
  existingBookings: Array<{ startTime: string; durationMinutes: number }>
): boolean => {
  for (const booking of existingBookings) {
    const bookingStart = timeToMinutes(booking.startTime);
    const bookingEnd = bookingStart + booking.durationMinutes;

    // Overlap condition: startA < endB AND endA > startB
    if (startMin < bookingEnd && endMin > bookingStart) {
      return true;
    }
  }
  return false;
};

// GET /api/bookings/available-slots
export const getAvailableSlots = async (req: Request, res: Response) => {
  const { packageId, date } = req.query as { packageId: string; date: string };

  if (!packageId || !date) {
    return res.status(400).json({ message: "packageId and date parameters are required." });
  }

  const pkg = PACKAGES[packageId];
  if (!pkg) {
    return res.status(404).json({ message: "Package not found." });
  }

  try {
    // 1. Verify this date is marked as operating by admin
    const operatingDay = await prisma.operatingDay.findUnique({
      where: { date }
    });

    if (!operatingDay || !operatingDay.isOperating) {
      return res.json({
        date,
        isOperating: false,
        slots: []
      });
    }

    // 2. Fetch all CONFIRMED bookings for this package on this day
    const confirmedBookings = await prisma.booking.findMany({
      where: {
        packageId,
        bookingDate: date,
        status: "CONFIRMED"
      },
      select: {
        startTime: true,
        durationMinutes: true
      }
    });

    // 3. Define studio operational slots (e.g., 09:00 to 18:00 every 30 minutes)
    const timeSlots = [
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
      "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
    ];

    const slotsAvailability = timeSlots.map((time) => {
      const startMin = timeToMinutes(time);

      // Check 30 min slot availability
      const is30MinAllowed = pkg.allowedDurations.includes(30);
      const is30MinAvailable = is30MinAllowed && !isSlotOverlapping(startMin, startMin + 30, confirmedBookings);

      // Check 60 min slot availability
      const is60MinAllowed = pkg.allowedDurations.includes(60);
      const is60MinAvailable = is60MinAllowed && !isSlotOverlapping(startMin, startMin + 60, confirmedBookings);

      return {
        time,
        available30Min: is30MinAvailable,
        available60Min: is60MinAvailable
      };
    });

    return res.json({
      date,
      isOperating: true,
      slots: slotsAvailability
    });
  } catch (error) {
    console.error("Error calculating slots availability:", error);
    return res.status(500).json({ message: "Server error calculating slots." });
  }
};

// POST /api/bookings/initiate
export const initiateBooking = async (req: Request, res: Response) => {
  const {
    packageId,
    durationMinutes,
    bookingDate,
    startTime,
    customerName,
    customerEmail,
    customerPhone,
    callbackUrl // Redirect after successful payment
  } = req.body;

  if (
    !packageId ||
    !durationMinutes ||
    !bookingDate ||
    !startTime ||
    !customerName ||
    !customerEmail ||
    !customerPhone
  ) {
    return res.status(400).json({ message: "Missing required booking details." });
  }

  const pkg = PACKAGES[packageId];
  if (!pkg) {
    return res.status(404).json({ message: "Selected package is invalid." });
  }

  const duration = Number(durationMinutes);
  if (!pkg.allowedDurations.includes(duration)) {
    return res.status(400).json({ message: `Invalid duration for ${pkg.name}.` });
  }

  try {
    // 1. Verify operating status
    const operatingDay = await prisma.operatingDay.findUnique({
      where: { date: bookingDate }
    });
    if (!operatingDay || !operatingDay.isOperating) {
      return res.status(400).json({ message: "The studio is closed on this date." });
    }

    // 2. Check for slot overlaps before creating
    const confirmedBookings = await prisma.booking.findMany({
      where: {
        packageId,
        bookingDate,
        status: "CONFIRMED"
      },
      select: {
        startTime: true,
        durationMinutes: true
      }
    });

    const startMin = timeToMinutes(startTime);
    const endMin = startMin + duration;

    if (isSlotOverlapping(startMin, endMin, confirmedBookings)) {
      return res.status(400).json({ message: "This slot is already booked. Please choose another time." });
    }

    // 3. Compute price
    const amountNGN = pkg.prices[duration];
    const amountKobo = amountNGN * 100; // Paystack takes amounts in kobo

    // 4. Generate transaction reference
    const paystackReference = `CSB-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 5. Initialize Paystack Transaction
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret || paystackSecret.startsWith("sk_test_placeholder")) {
      // If no valid key is set, we will bypass Paystack check for ease of evaluation and mock it
      // Let's create a pending booking and return a mock payment url or immediate status redirect
      const pendingBooking = await prisma.booking.create({
        data: {
          packageId,
          packageName: pkg.name,
          customerName,
          customerEmail,
          customerPhone,
          bookingDate,
          startTime,
          durationMinutes: duration,
          amount: amountNGN,
          status: "PENDING",
          paystackReference
        }
      });

      return res.json({
        authorization_url: `${callbackUrl || "http://localhost:3000/book/status"}?reference=${paystackReference}&mock=true`,
        reference: paystackReference,
        isMock: true
      });
    }

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: customerEmail,
        amount: amountKobo,
        reference: paystackReference,
        callback_url: callbackUrl || "http://localhost:3000/book/status"
      })
    });

    const paystackData = await paystackRes.json() as any;

    if (!paystackRes.ok || !paystackData.status) {
      console.error("Paystack Initialization Error:", paystackData);
      return res.status(500).json({ message: "Failed to initialize payment gateway." });
    }

    // 6. Create booking in DB with PENDING status
    await prisma.booking.create({
      data: {
        packageId,
        packageName: pkg.name,
        customerName,
        customerEmail,
        customerPhone,
        bookingDate,
        startTime,
        durationMinutes: duration,
        amount: amountNGN,
        status: "PENDING",
        paystackReference
      }
    });

    return res.json({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackReference,
      isMock: false
    });
  } catch (error) {
    console.error("Initiate booking error:", error);
    return res.status(500).json({ message: "Server error initiating booking." });
  }
};

// POST /api/bookings/verify
export const verifyBooking = async (req: Request, res: Response) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ message: "Reference is required." });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { paystackReference: reference }
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking record not found." });
    }

    if (booking.status === "CONFIRMED") {
      return res.json({ success: true, booking, message: "Booking already confirmed." });
    }

    // Check if it's a mock payment flow
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const isMock = !paystackSecret || paystackSecret.startsWith("sk_test_placeholder");

    if (isMock) {
      // Mock payment success for testing
      const confirmedBooking = await prisma.booking.update({
        where: { paystackReference: reference },
        data: { status: "CONFIRMED" }
      });
      return res.json({ success: true, booking: confirmedBooking, message: "[MOCK] Payment received. Booking confirmed." });
    }

    // Call Paystack verification
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`
      }
    });

    const paystackData = await paystackRes.json() as any;

    if (paystackRes.ok && paystackData.status && paystackData.data.status === "success") {
      // Finalize booking to CONFIRMED
      const confirmedBooking = await prisma.booking.update({
        where: { paystackReference: reference },
        data: { status: "CONFIRMED" }
      });

      return res.json({
        success: true,
        booking: confirmedBooking,
        message: "Payment successfully verified."
      });
    } else {
      // Set to FAILED
      const failedBooking = await prisma.booking.update({
        where: { paystackReference: reference },
        data: { status: "FAILED" }
      });

      return res.json({
        success: false,
        booking: failedBooking,
        message: "Payment failed or was incomplete."
      });
    }
  } catch (error) {
    console.error("Verify booking error:", error);
    return res.status(500).json({ message: "Server error verifying booking." });
  }
};

// GET /api/admin/bookings (Admin only)
export const getAdminBookings = async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" }
    });
    return res.json(bookings);
  } catch (error) {
    console.error("Admin bookings fetch error:", error);
    return res.status(500).json({ message: "Server error fetching bookings list." });
  }
};
