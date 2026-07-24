import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.rallye.mobile',
  appName: 'Rallye',
  webDir: 'dist',
  // BEAC-1723/BEAC-2020: com o app em foreground no iOS, o SO NÃO mostra a
  // notificação nativa por padrão a menos que presentationOptions liste como
  // — sem isso, push com o app aberto simplesmente não aparece no iOS (a
  // Android já mostra por padrão). badge/sound/alert é o trio padrão usado
  // pela maioria dos apps.
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
