import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Font,
} from '@react-email/components'

interface GenericTemplateProps {
  subject: string
  bodyHtml: string
}

export function GenericTemplate({ bodyHtml }: GenericTemplateProps) {
  return (
    <Html>
      <Head>
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
          <Section style={{ backgroundColor: '#1a1a1a', padding: '24px 32px' }}>
            <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: 0 }}>
              Wildrock
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: '32px' }}>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          {/* Footer */}
          <Section style={{ padding: '0 32px 32px' }}>
            <Hr style={{ borderColor: '#e5e7eb', margin: '0 0 24px' }} />
            <Text style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>
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
