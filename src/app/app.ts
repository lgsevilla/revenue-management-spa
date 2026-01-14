import { Component, OnInit, signal } from '@angular/core';
import { HealthService } from './services/health';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit {
  protected readonly title = signal('revenue-management-spa');

  health = signal<any | null>(null);
  error = signal<string | null>(null);

  constructor(private healthService: HealthService) {}

  ngOnInit(): void {
    this.healthService.ping().subscribe({
      next: (data) => this.health.set(data),
      error: (err) => this.error.set(err?.message ?? 'Request failed')
    });
  }
}
