import type { Role } from '@contrack/contract';
import { CARD_A, workforceKit } from '../testing/workforce-test-kit';
import { crewToDto, personToDto } from './workforce.mapper';

describe('workforce mapper: wages by role', () => {
    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
        'a person\'s daily wage for %s: shown %s',
        async (role, shown) => {
            const kit = workforceKit();
            const p = await kit.seedPerson({ dailyWage: 950 });
            const dto = personToDto(p, role);
            expect(dto.dailyWage).toBe(shown ? 950 : null);
            expect(dto.wagesHidden).toBe(!shown);
        },
    );

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        'a crew\'s daily cost and override for %s: shown %s',
        async (role, shown) => {
            const kit = workforceKit();
            const crew = await kit.seedCrew({ rateCardId: CARD_A, dailyCostOverride: 4200 });
            const dto = crewToDto({ crew, dailyCost: 4200 }, role);
            expect(dto.dailyCost).toBe(shown ? 4200 : null);
            expect(dto.dailyCostOverride).toBe(shown ? 4200 : null);
            expect(dto.wagesHidden).toBe(!shown);
            expect(dto.rateCardId).toBe(CARD_A);
            expect(dto.skilledCount).toBe(2);
        },
    );
});
