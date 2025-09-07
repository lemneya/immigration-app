import { 
  CaseStatusAlert, 
  CaseTrackingConfig, 
  NotificationChannel,
  CaseStatusServiceConfig 
} from '../types';

export class NotificationService {
  private config: CaseStatusServiceConfig['notificationConfig'];

  constructor(config: CaseStatusServiceConfig['notificationConfig']) {
    this.config = config;
  }

  /**
   * Send alert through configured notification channels
   */
  async sendAlert(alert: CaseStatusAlert, trackingConfig: CaseTrackingConfig): Promise<void> {
    console.log(`📬 Sending alert ${alert.id} for case ${alert.receiptNumber}`);

    const promises: Promise<any>[] = [];

    for (const channel of alert.channels) {
      switch (channel) {
        case 'email':
          if (trackingConfig.email) {
            promises.push(this.sendEmailAlert(alert, trackingConfig.email));
          }
          break;
        case 'sms':
          if (trackingConfig.phone) {
            promises.push(this.sendSmsAlert(alert, trackingConfig.phone));
          }
          break;
        case 'webhook':
          if (trackingConfig.notificationPreferences.webhook) {
            promises.push(this.sendWebhookAlert(alert, trackingConfig.notificationPreferences.webhook));
          }
          break;
      }
    }

    try {
      await Promise.allSettled(promises);
      alert.sentAt = new Date().toISOString();
      console.log(`✅ Alert ${alert.id} sent successfully`);
    } catch (error) {
      console.error(`❌ Failed to send alert ${alert.id}:`, error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailAlert(alert: CaseStatusAlert, email: string): Promise<void> {
    try {
      if (!this.config.email) {
        throw new Error('Email configuration not provided');
      }

      // In a real implementation, you would use an email service like SendGrid, AWS SES, or nodemailer
      console.log(`📧 Sending email alert to ${email}`);
      
      const emailContent = {
        to: email,
        from: this.config.email.from,
        subject: alert.title,
        html: this.generateEmailHtml(alert),
        text: this.generateEmailText(alert)
      };

      // Simulate email sending
      console.log('Email content:', emailContent);
      
      // In real implementation:
      // await emailService.send(emailContent);

    } catch (error: any) {
      console.error('Failed to send email alert:', error.message);
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSmsAlert(alert: CaseStatusAlert, phone: string): Promise<void> {
    try {
      if (!this.config.sms) {
        throw new Error('SMS configuration not provided');
      }

      console.log(`📱 Sending SMS alert to ${phone}`);

      const smsContent = {
        to: phone,
        from: this.config.sms.from,
        body: this.generateSmsText(alert)
      };

      // In a real implementation, you would use Twilio, AWS SNS, or similar
      console.log('SMS content:', smsContent);

      // In real implementation:
      // await smsService.send(smsContent);

    } catch (error: any) {
      console.error('Failed to send SMS alert:', error.message);
      throw error;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookAlert(alert: CaseStatusAlert, webhookUrl: string): Promise<void> {
    try {
      console.log(`🔗 Sending webhook alert to ${webhookUrl}`);

      const payload = {
        alert_id: alert.id,
        receipt_number: alert.receiptNumber,
        alert_type: alert.alertType,
        title: alert.title,
        message: alert.message,
        priority: alert.priority,
        created_at: alert.createdAt,
        metadata: alert.metadata
      };

      // In a real implementation, you would make an HTTP request to the webhook URL
      console.log('Webhook payload:', payload);

      // In real implementation:
      // const response = await axios.post(webhookUrl, payload, {
      //   timeout: this.config.webhook?.timeout || 10000,
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'User-Agent': 'Immigration-Suite-Case-Status/1.0'
      //   }
      // });

    } catch (error: any) {
      console.error('Failed to send webhook alert:', error.message);
      throw error;
    }
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHtml(alert: CaseStatusAlert): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1f4788; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .alert-high { border-left: 4px solid #ff6b35; }
            .alert-urgent { border-left: 4px solid #d32f2f; }
            .alert-medium { border-left: 4px solid #ffa726; }
            .alert-low { border-left: 4px solid #66bb6a; }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
            .case-number { font-family: monospace; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>USCIS Case Status Update</h1>
            </div>
            <div class="content alert-${alert.priority}">
              <h2>${alert.title}</h2>
              <p><strong>Receipt Number:</strong> <span class="case-number">${alert.receiptNumber}</span></p>
              <p><strong>Alert Type:</strong> ${this.formatAlertType(alert.alertType)}</p>
              <p><strong>Priority:</strong> ${alert.priority.toUpperCase()}</p>
              <p><strong>Date:</strong> ${new Date(alert.createdAt).toLocaleDateString()}</p>
              <div style="margin-top: 20px; padding: 15px; background-color: white; border-radius: 5px;">
                <p>${alert.message}</p>
              </div>
              ${alert.metadata ? `
                <div style="margin-top: 20px;">
                  <h3>Additional Information:</h3>
                  <ul>
                    ${alert.metadata.previousStatus ? `<li><strong>Previous Status:</strong> ${alert.metadata.previousStatus}</li>` : ''}
                    ${alert.metadata.newStatus ? `<li><strong>New Status:</strong> ${alert.metadata.newStatus}</li>` : ''}
                    ${alert.metadata.caseType ? `<li><strong>Case Type:</strong> ${alert.metadata.caseType}</li>` : ''}
                  </ul>
                </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>This notification was sent by the Immigration Suite Case Status Tracking System.</p>
              <p>If you no longer wish to receive these notifications, please contact your system administrator.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content
   */
  private generateEmailText(alert: CaseStatusAlert): string {
    let text = `USCIS Case Status Update\n\n`;
    text += `Receipt Number: ${alert.receiptNumber}\n`;
    text += `Alert Type: ${this.formatAlertType(alert.alertType)}\n`;
    text += `Priority: ${alert.priority.toUpperCase()}\n`;
    text += `Date: ${new Date(alert.createdAt).toLocaleDateString()}\n\n`;
    text += `Message:\n${alert.message}\n\n`;

    if (alert.metadata) {
      text += `Additional Information:\n`;
      if (alert.metadata.previousStatus) {
        text += `- Previous Status: ${alert.metadata.previousStatus}\n`;
      }
      if (alert.metadata.newStatus) {
        text += `- New Status: ${alert.metadata.newStatus}\n`;
      }
      if (alert.metadata.caseType) {
        text += `- Case Type: ${alert.metadata.caseType}\n`;
      }
      text += `\n`;
    }

    text += `This notification was sent by the Immigration Suite Case Status Tracking System.\n`;
    text += `If you no longer wish to receive these notifications, please contact your system administrator.`;

    return text;
  }

  /**
   * Generate SMS text content (must be concise)
   */
  private generateSmsText(alert: CaseStatusAlert): string {
    let text = `USCIS Alert: ${alert.receiptNumber} - `;
    
    switch (alert.alertType) {
      case 'case_approved':
        text += `Your case has been APPROVED! 🎉`;
        break;
      case 'case_rejected':
        text += `Your case was denied. Please review the notice for next steps.`;
        break;
      case 'interview_scheduled':
        text += `Interview scheduled. Check your notices for details.`;
        break;
      case 'biometrics_scheduled':
        text += `Biometrics appointment scheduled.`;
        break;
      case 'card_produced':
        text += `Your card has been produced! 📫`;
        break;
      case 'rfe_received':
        text += `Request for Evidence (RFE) issued. Action required.`;
        break;
      default:
        text += `Status updated: ${alert.metadata?.newStatus || 'Check your case online'}`;
    }

    // Keep SMS under 160 characters
    if (text.length > 160) {
      text = text.substring(0, 157) + '...';
    }

    return text;
  }

  /**
   * Format alert type for display
   */
  private formatAlertType(alertType: string): string {
    return alertType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Send test notification
   */
  async sendTestNotification(channel: NotificationChannel, recipient: string): Promise<{ success: boolean; error?: string }> {
    try {
      const testAlert: CaseStatusAlert = {
        id: 'test-alert',
        receiptNumber: 'MSC2190000001',
        alertType: 'status_change',
        title: 'Test Notification - Immigration Suite',
        message: 'This is a test notification to verify your notification settings are working correctly.',
        priority: 'low',
        createdAt: new Date().toISOString(),
        channels: [channel]
      };

      switch (channel) {
        case 'email':
          await this.sendEmailAlert(testAlert, recipient);
          break;
        case 'sms':
          await this.sendSmsAlert(testAlert, recipient);
          break;
        case 'webhook':
          await this.sendWebhookAlert(testAlert, recipient);
          break;
      }

      return { success: true };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}