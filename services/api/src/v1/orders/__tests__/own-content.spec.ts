import { AppErrorCode } from '@/common/lib/error';
import { assertNotOwnContent } from '../own-content';

const CREATOR = 'f43bfce7-b141-4351-9723-989d972c35f0';
const BUYER = '62c22ca0-277f-4036-bf6c-624ee93808b3';

describe('assertNotOwnContent', () => {
  it('lets a buyer purchase content made by someone else', () => {
    expect(() => assertNotOwnContent(BUYER, [{ creatorId: CREATOR }])).not.toThrow();
  });

  it('lets anyone purchase content that has no creator, such as a legacy topic', () => {
    expect(() => assertNotOwnContent(BUYER, [{ creatorId: null }])).not.toThrow();
  });

  it('refuses when the buyer is the creator of the item', () => {
    expect(() => assertNotOwnContent(CREATOR, [{ creatorId: CREATOR }])).toThrow(
      expect.objectContaining({ statusCode: 403, code: AppErrorCode.FORBIDDEN }),
    );
  });

  it('refuses a mixed order when any line belongs to the buyer', () => {
    expect(() => assertNotOwnContent(CREATOR, [{ creatorId: BUYER }, { creatorId: CREATOR }])).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});
