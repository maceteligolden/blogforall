import { singleton } from "tsyringe";
import type { PublishDestination } from "../constants";

@singleton()
export class PublishDestinationOverride {
  private readonly values = new Map<string, PublishDestination[]>();

  set(siteId: string, blogId: string, destinations: PublishDestination[]): void {
    this.values.set(`${siteId}:${blogId}`, destinations);
  }

  take(siteId: string, blogId: string): PublishDestination[] | undefined {
    const key = `${siteId}:${blogId}`;
    const value = this.values.get(key);
    this.values.delete(key);
    return value;
  }
}
