import { BaseEntity } from "../interfaces";

export interface Card extends BaseEntity {
  stripe_card_token: string;
  last_digits: string;
  expire_date: string;
  type: string;
  stripe_customer_id: string;
  is_default: boolean;
}
