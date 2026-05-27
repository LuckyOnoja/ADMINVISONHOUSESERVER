import { Request, Response } from "express";
import prisma from "../db";

export const getOperatingDays = async (req: Request, res: Response) => {
  try {
    const days = await prisma.operatingDay.findMany({
      orderBy: { date: "asc" }
    });
    return res.json(days);
  } catch (error) {
    console.error("Fetch operating days error:", error);
    return res.status(500).json({ message: "Server error fetching operating days." });
  }
};

export const updateOperatingDay = async (req: Request, res: Response) => {
  const { date, isOperating } = req.body;

  if (!date) {
    return res.status(400).json({ message: "Date is required (YYYY-MM-DD)." });
  }

  try {
    const updatedDay = await prisma.operatingDay.upsert({
      where: { date },
      update: { isOperating: !!isOperating },
      create: {
        date,
        isOperating: !!isOperating
      }
    });

    return res.json({
      message: `Operating day ${date} updated successfully.`,
      operatingDay: updatedDay
    });
  } catch (error) {
    console.error("Update operating day error:", error);
    return res.status(500).json({ message: "Server error setting operating day." });
  }
};
