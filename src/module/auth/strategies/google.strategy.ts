import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);
  
  constructor(config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = config.get<string>('GOOGLE_REDIRECT');
    
    if (!clientID || !clientSecret || !callbackURL) {
      throw new InternalServerErrorException('Google env missing');
    }
    
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any): Promise<any> {
    const { name, emails, id } = profile;
    const email = emails && emails.length > 0 ? emails[0].value : null;
    
    const fullName = name ? `${name.familyName || ''} ${name.givenName || ''}`.trim() : 'Unknown';

    this.logger.log(
      `Google login success: Email=${email}, GoogleId=${id}, Name=${fullName}`,
    );

    return {
      email,
      googleId: id,
      name: fullName,
    };
  }
}
