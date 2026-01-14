import { TestBed } from '@angular/core/testing';

import { HealthService } from './health';

describe('Health', () => {
  let service: HealthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HealthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
