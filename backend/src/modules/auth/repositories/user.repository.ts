import { injectable } from "tsyringe";
import User, { User as UserType } from "../../../shared/schemas/user.schema";

@injectable()
export class UserRepository {
  async create(userData: Partial<UserType>): Promise<UserType> {
    const user = new User(userData);
    return user.save();
  }

  async findByEmail(email: string): Promise<UserType | null> {
    return User.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string): Promise<UserType | null> {
    return User.findById(id);
  }

  async update(id: string, updateData: Partial<UserType>): Promise<UserType | null> {
    updateData.updated_at = new Date();
    return User.findByIdAndUpdate(id, updateData, { new: true });
  }

  async updateSessionToken(id: string, token: string | null): Promise<void> {
    await User.findByIdAndUpdate(id, { sessionToken: token, updated_at: new Date() });
  }

  async findByResetToken(hashedToken: string): Promise<UserType | null> {
    return User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });
  }

  async setResetCode(id: string, hashedCode: string, expiresAt: Date): Promise<void> {
    await User.findByIdAndUpdate(id, {
      resetPasswordToken: hashedCode,
      resetPasswordExpires: expiresAt,
      resetPasswordAttempts: 0,
      updated_at: new Date(),
    });
  }

  async incrementResetAttempts(id: string): Promise<number> {
    const updated = await User.findByIdAndUpdate(
      id,
      { $inc: { resetPasswordAttempts: 1 }, updated_at: new Date() },
      { new: true }
    );
    return updated?.resetPasswordAttempts ?? 0;
  }

  async clearResetCode(id: string): Promise<void> {
    await User.findByIdAndUpdate(id, {
      $set: { resetPasswordAttempts: 0, updated_at: new Date() },
      $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await User.findByIdAndUpdate(id, {
      $set: { password: hashedPassword, resetPasswordAttempts: 0, updated_at: new Date() },
      $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
    });
  }
}
