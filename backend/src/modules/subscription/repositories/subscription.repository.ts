import { injectable } from "tsyringe";
import mongoose from "mongoose";
import { SubscriptionModel, Subscription, SubscriptionStatus } from "../../../shared/schemas/subscription.schema";

@injectable()
export class SubscriptionRepository {
  async create(subscriptionData: Partial<Subscription>): Promise<Subscription> {
    const subscription = new SubscriptionModel(subscriptionData);
    return subscription.save();
  }

  async findById(id: string): Promise<Subscription | null> {
    return SubscriptionModel.findById(id);
  }

  async findByUserId(userId: string): Promise<Subscription | null> {
    return SubscriptionModel.findOne({ userId }).sort({ created_at: -1 });
  }

  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    return SubscriptionModel.findOne({
      userId,
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.FREE] },
    }).sort({ created_at: -1 });
  }

  async findByUserIdWithSession(userId: string, session: mongoose.ClientSession): Promise<Subscription | null> {
    return SubscriptionModel.findOne({ userId }).session(session).sort({ created_at: -1 });
  }

  async findByProviderSubscriptionId(providerSubscriptionId: string): Promise<Subscription | null> {
    return SubscriptionModel.findOne({ providerSubscriptionId });
  }

  async update(id: string, updateData: Partial<Subscription>): Promise<Subscription | null> {
    return SubscriptionModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async updateByUserId(userId: string, updateData: Partial<Subscription>): Promise<Subscription | null> {
    return SubscriptionModel.findOneAndUpdate({ userId }, updateData, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await SubscriptionModel.findByIdAndDelete(id);
    return !!result;
  }
}
