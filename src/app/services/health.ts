import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface HealthResponse {
  ok: boolean; 
  service: string
}

@Injectable({
  providedIn: 'root',
})
export class HealthService {

  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  ping(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(
      `${this.apiUrl}/health`
    );
  }
}
