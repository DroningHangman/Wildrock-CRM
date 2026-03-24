import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Font,
  Img,
} from '@react-email/components'

function processBody(html: string): string {
  // If no HTML tags detected, treat as plain text
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html
      .split(/\n\n+/)
      .map(p => `<p style="margin:0 0 16px">${p.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }
  return html
}

interface GenericTemplateProps {
  subject: string
  bodyHtml: string
}

export function GenericTemplate({ bodyHtml }: GenericTemplateProps) {
  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          {/* Header */}
          <Section style={{ backgroundColor: '#ffffff', padding: '24px 32px', textAlign: 'center' }}>
            <Img
              src="https://wildrock-crm.vercel.app/wildrock-logo.png"
              alt="Wildrock"
              width="200"
              style={{ display: 'block', margin: '0 auto' }}
            />
          </Section>

          {/* Divider */}
          <Hr style={{ borderColor: '#6abf69', borderWidth: '2px', margin: '0' }} />

          {/* Body */}
          <Section style={{ padding: '32px' }}>
            <div
              style={{ fontSize: '16px', lineHeight: '1.6', color: '#374151' }}
              dangerouslySetInnerHTML={{ __html: processBody(bodyHtml) }}
            />
          </Section>

          {/* Footer */}
          <Section style={{ padding: '0 32px 32px' }}>
            <Hr style={{ borderColor: '#e5e7eb', margin: '0 0 24px' }} />
            <Text style={{ color: '#9ca3af', fontSize: '12px', margin: 0, textAlign: 'center' }}>
              You received this email because you are in the Wildrock community.
              If you have questions, reply to this email or contact us directly.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default GenericTemplate
