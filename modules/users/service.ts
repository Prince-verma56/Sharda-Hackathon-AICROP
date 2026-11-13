import { getAppUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { UpdateProfileInput } from "./index";

/** Users are created only by the phone-OTP login (server/auth/identity.ts); this reads/updates them. */
export class UserService {
  static async getCurrentUser() {
    const identity = await getAppUser();
    if (!identity) return null;
    return db.user.findUnique({ where: { id: identity.userId } });
  }

  static async getOrCreateCurrentUser() {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return user;
  }

  static async updateProfile(data: UpdateProfileInput) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return db.user.update({ where: { id: user.id }, data });
  }
}
