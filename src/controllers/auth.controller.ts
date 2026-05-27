import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "creative_studio_secret_2026_key_super_encrypted";

export const loginAdmin = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Please provide username and password." });
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { username }
    });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: "24h" });

    return res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error occurred during login." });
  }
};

// Seeder to guarantee there is always at least one admin
export const seedDefaultAdmin = async () => {
  try {
    const adminCount = await prisma.admin.count();
    if (adminCount === 0) {
      const defaultUsername = "admin";
      const defaultPassword = "adminpassword123";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      await prisma.admin.create({
        data: {
          username: defaultUsername,
          password: hashedPassword
        }
      });
      console.log("--------------------------------------------------");
      console.log(`[SEED] Created default admin account:`);
      console.log(`Username: ${defaultUsername}`);
      console.log(`Password: ${defaultPassword}`);
      console.log("--------------------------------------------------");
    }
  } catch (error) {
    console.error("[SEED ERROR] Failed to seed default admin:", error);
  }
};
