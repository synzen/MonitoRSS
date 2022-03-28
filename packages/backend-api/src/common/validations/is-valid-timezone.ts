import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@ValidatorConstraint({ name: 'IsValidTimezone', async: false })
export class IsValidTimezone implements ValidatorConstraintInterface {
  validate(text: string) {
    try {
      return dayjs().tz(text).isValid();
    } catch (err) {
      return false;
    }
  }

  defaultMessage() {
    // here you can provide default error message if validation failed
    return 'Invalid timezone';
  }
}
