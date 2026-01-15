import { Component, OnInit, signal } from '@angular/core';
import { ApiService } from './services/api';
import { Config } from './models/config.model';
import { Week } from './models/week.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit {
  config = signal<Config | null>(null);
  weeks = signal<Week[]>([]);
  error = signal<string | null>(null);

  form = {
    weekEnding: '',
    actualRevenue: null as number | null,
    openOrders: null as number | null,
    revenuePerFte: null as number | null,
    targetRevenue: null as number | null
  };

  message = signal<string | null>(null);

  // simulate a restricted user for now (matches your API users)
  user = 'laurence';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getConfig(this.user).subscribe({
      next: c => this.config.set(c),
      error: e => this.error.set(e?.message ?? 'Failed to load config')
    });

    this.api.getWeeks(this.user).subscribe({
      next: w => this.weeks.set(
        [...w].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
      ),
      error: e => this.error.set(e?.message ?? 'Failed to load weeks')
    });
  }

  private refreshWeeks(): void {
    this.api.getWeeks(this.user).subscribe({
      next: w => this.weeks.set([...w].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))),
      error: e => this.error.set(e?.message ?? 'Failed to load weeks')
    });
  }

  submitForm(): void {
    this.message.set(null);
    this.error.set(null);

    const weekEnding = this.form.weekEnding?.trim();
    if (!weekEnding) {
      this.error.set('weekEnding is required');
      return;
    }

  // Build payload with only provided fields (optional fields remain optional)
    const payload: any = { weekEnding };

    if (this.form.actualRevenue !== null) payload.actualRevenue = this.form.actualRevenue;
    if (this.form.openOrders !== null) payload.openOrders = this.form.openOrders;
    if (this.form.revenuePerFte !== null) payload.revenuePerFte = this.form.revenuePerFte;
    if (this.form.targetRevenue !== null) payload.targetRevenue = this.form.targetRevenue;

    const exists = this.weeks().some(w => w.weekEnding === weekEnding);

    const req$ = exists
      ? this.api.updateWeek(this.user, weekEnding, payload)
      : this.api.createWeek(this.user, payload);

    req$.subscribe({
      next: () => {
        this.message.set(exists ? 'Week updated.' : 'Week created.');
        this.refreshWeeks();
      },
      error: (e) => {
        this.error.set(e?.error?.error ?? e?.message ?? 'Save failed');
      }
    });
  }

  deleteByWeekEnding(): void {
    this.message.set(null);
    this.error.set(null);

    const weekEnding = this.form.weekEnding?.trim();
    if (!weekEnding) {
      this.error.set('weekEnding is required for delete');
      return;
    }

    this.api.deleteWeek(this.user, weekEnding).subscribe({
      next: () => {
        this.message.set('Week deleted.');
        this.refreshWeeks();
      },
      error: (e) => {
        this.error.set(e?.error?.error ?? e?.message ?? 'Delete failed');
      }
    });
  }
}