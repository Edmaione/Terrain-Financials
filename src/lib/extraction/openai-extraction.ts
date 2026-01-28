import { ExtractionProvider, RawStatementExtraction } from './provider'
import { StatementProfile } from './statement-profiles'
import { extractStatementData, ExtractionAccountContext } from '@/lib/openai'

/**
 * OpenAI-based extraction provider. Delegates to the existing
 * extractStatementData() function in openai.ts.
 */
export class OpenAIExtractionProvider implements ExtractionProvider {
  name = 'openai'

  async extractStatement(
    _pageImages: string[],
    profile: StatementProfile,
    pdfBuffer?: Buffer
  ): Promise<RawStatementExtraction | null> {
    if (!pdfBuffer) {
      console.warn('[openai-extraction] pdfBuffer required for OpenAI provider')
      return null
    }

    const accountContext: ExtractionAccountContext = {
      accountType: profile.accountType,
      institution: profile.key.replace(`_${profile.accountType}`, ''),
    }

    const result = await extractStatementData(pdfBuffer, accountContext)
    return result as RawStatementExtraction | null
  }
}
