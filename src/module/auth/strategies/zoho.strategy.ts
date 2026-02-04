import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  ZOHO_AUTHORIZATION_URL,
  ZOHO_TOKEN_URL,
  ZOHO_USER_INFO_URL,
  ZOHO_STRATEGY,
} from 'src/common/constants/zoho.constant';

interface ZohoUserInfo {
  Email: string;
  ZUID: string;
  First_Name: string;
  Last_Name: string;
}
@Injectable()
export class ZohoStrategy extends PassportStrategy(Strategy, ZOHO_STRATEGY) {
  constructor(config: ConfigService) {
    const clientId = config.get<string>('ZOHO_CLIENT_ID');
    const clientSecret = config.get<string>('ZOHO_CLIENT_SECRET');
    const callback = config.get<string>('ZOHO_REDIRECT');
    if (!clientId || !clientSecret || !callback) {
      throw new InternalServerErrorException('Zoho env missing');
    }
    super({
      authorizationURL: ZOHO_AUTHORIZATION_URL,
      tokenURL: ZOHO_TOKEN_URL,
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: callback,
      scope: ['AaaServer.profile.READ'],
    });
  }
  // , refreshToken: string
  async validate(accessToken: any) {
    const res = await axios.get<ZohoUserInfo>(ZOHO_USER_INFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const { Email, ZUID, First_Name, Last_Name } = res.data;

    return {
      email: Email,
      zohoId: String(ZUID),
      name: `${First_Name} ${Last_Name}`,
    };
  }
}
