export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  employeeName: string;
  summary: string;
  submittedAt: string;
  href: string;
  actionable: boolean;
}

export interface NotificationFeedResponse {
  ok?: boolean;
  count?: number;
  items?: NotificationItem[];
}
