import "server-only";
import { prisma } from "@/lib/prisma";
import { getDemoHotelName, isDemoMode } from "@/lib/demo";

export async function getHotelName() {
  if (isDemoMode()) return getDemoHotelName();
  const setting = await prisma.hotelSetting.findUnique({
    where: { key: "hotelName" },
    select: { value: true },
  });
  return setting?.value || "Aurelia Hotel Collection";
}
