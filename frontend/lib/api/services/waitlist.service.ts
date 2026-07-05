import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface JoinWaitlistRequest {
  email: string;
  first_name: string;
  last_name: string;
}

export class WaitlistService {
  static async joinWaitlist(data: JoinWaitlistRequest): Promise<void> {
    await apiClient.post(API_ENDPOINTS.WAITLIST.JOIN, data);
  }
}
