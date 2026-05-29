export interface DiscordViewComponent {
  type: number;
  components: Array<DiscordViewComponentButton>;
}

export interface DiscordViewComponentButton {
  type: number;
  style: number;
  label: string;
  url?: string;
}
