import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Config } from '../models/config.model';
import { Week } from '../models/week.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getConfig(user: string): Observable<Config> {
    return this.http.get<Config>(`${this.baseUrl}/config`, {
      headers: { 'x-user': user }
    });
  }

  getWeeks(user: string): Observable<Week[]> {
    return this.http.get<Week[]>(`${this.baseUrl}/weeks`, {
      headers: { 'x-user': user }
    });
  }

  createWeek(user: string, payload: any) {
    return this.http.post<Week>(`${this.baseUrl}/weeks`, payload, {
      headers: { 'x-user': user }
    });
  }

  updateWeek(user: string, weekEnding: string, payload: any) {
    return this.http.put<Week>(`${this.baseUrl}/weeks/${weekEnding}`, payload, {
      headers: { 'x-user': user }
    });
  }

  deleteWeek(user: string, weekEnding: string) {
    return this.http.delete(`${this.baseUrl}/weeks/${weekEnding}`, {
      headers: { 'x-user': user }
    });
  }
}
