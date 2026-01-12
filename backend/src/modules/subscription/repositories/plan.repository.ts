import { injectable } from "tsyringe";
import { PlanModel, Plan } from "../../../shared/schemas/plan.schema";

@injectable()
export class PlanRepository {
  async create(planData: Partial<Plan>): Promise<Plan> {
    const plan = new PlanModel(planData);
    return plan.save();
  }

  async findById(id: string): Promise<Plan | null> {
    return PlanModel.findById(id);
  }

  async findByName(name: string): Promise<Plan | null> {
    return PlanModel.findOne({ name });
  }

  async findByStripePriceId(stripePriceId: string): Promise<Plan | null> {
    return PlanModel.findOne({ stripe_price_id: stripePriceId });
  }

  async fetchActivePlans(): Promise<Plan[]> {
    return PlanModel.find({ isActive: true }).sort({ price: 1 });
  }

  async findAll(): Promise<Plan[]> {
    return PlanModel.find().sort({ price: 1 });
  }

  async update(id: string, updateData: Partial<Plan>): Promise<Plan | null> {
    return PlanModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await PlanModel.findByIdAndDelete(id);
    return !!result;
  }
}
