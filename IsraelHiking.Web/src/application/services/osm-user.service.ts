import { HttpClient } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { NakebService } from "./nakeb.service";
import { Urls } from "../urls";
import type { OsmUserDetails, UserInfo } from "../models";

@Service()
export class OsmUserService {
    private readonly userIdToNameCache = new Map<string, string>();

    private readonly httpClient = inject(HttpClient);

    public async getUserName(userId: string): Promise<string> {
        if (this.userIdToNameCache.has(userId)) {
            return this.userIdToNameCache.get(userId);
        }
        if (userId === NakebService.USER_ID) {
            return NakebService.USER_NAME;
        }
        const osmUser = await firstValueFrom(this.httpClient.get<OsmUserDetails>(Urls.osmUser + userId));
        this.userIdToNameCache.set(userId, osmUser.user.display_name);
        return osmUser.user.display_name;
    }

    /**
     * Gets the details of the user this session is logged-in as, this requires a token
     */
    public async getLoggedInUserInfo(): Promise<UserInfo> {
        const detailsJson = await firstValueFrom(this.httpClient.get<OsmUserDetails>(Urls.osmUserDetails));
        const userInfo = {
            displayName: detailsJson.user.display_name,
            id: detailsJson.user.id.toString(),
            changeSets: detailsJson.user.changesets.count,
            imageUrl: detailsJson.user.img?.href
        };
        this.userIdToNameCache.set(userInfo.id, userInfo.displayName);
        return userInfo;
    }
}
