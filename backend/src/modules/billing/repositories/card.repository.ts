import { injectable } from "tsyringe";
import { CardModel, Card } from "../../../shared/schemas/card.schema";

@injectable()
export class CardRepository {
  async create(cardData: Partial<Card>): Promise<Card> {
    const card = new CardModel(cardData);
    return card.save();
  }

  async findById(id: string): Promise<Card | null> {
    return CardModel.findById(id);
  }

  async findByStripeToken(stripeCardToken: string): Promise<Card | null> {
    return CardModel.findOne({ stripe_card_token: stripeCardToken });
  }

  async findByCustomerId(stripeCustomerId: string): Promise<Card[]> {
    return CardModel.find({ stripe_customer_id: stripeCustomerId }).sort({ is_default: -1, created_at: -1 });
  }

  async findDefaultCard(stripeCustomerId: string): Promise<Card | null> {
    return CardModel.findOne({ stripe_customer_id: stripeCustomerId, is_default: true });
  }

  async update(id: string, updateData: Partial<Card>): Promise<Card | null> {
    return CardModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async setAllCardsNonDefault(stripeCustomerId: string): Promise<void> {
    await CardModel.updateMany({ stripe_customer_id: stripeCustomerId }, { is_default: false });
  }

  async delete(id: string): Promise<boolean> {
    const result = await CardModel.findByIdAndDelete(id);
    return !!result;
  }
}
