import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'

const PrivacyContext = createContext(null)

export const ROLE_OPTIONS = [
  { value: 'invigilator', label: 'Invigilator' },
  { value: 'auditor', label: 'Auditor / Reviewer' },
  { value: 'guest_demo', label: 'Guest / Demo' },
]

export const INTENT_OPTIONS = [
  { value: 'live_verification', label: 'Live Verification' },
  { value: 'post_exam_review', label: 'Post-Exam Review' },
  { value: 'spot_check', label: 'Spot Check' },
  { value: 'demo_walkthrough', label: 'Demo Walkthrough' },
]

export const CONTEXT_OPTIONS = [
  { value: 'exam_in_progress', label: 'Exam In Progress 🟢' },
  { value: 'exam_closed', label: 'Exam Closed (Post-Exam) 🔴' },
]

export const PERSONAS = [
  {
    id: 'invigilator',
    role: 'invigilator',
    intent: 'live_verification',
    context: 'exam_in_progress',
    title: 'Invigilator @ Gate',
    shortLabel: 'Invigilator',
    icon: '🟢',
    tag: 'Full Gate Access',
    tone: 'green',
    targetRoute: '/verify',
    description: 'Active gate verification during live exam. Full candidate identity, live camera stream, and exact raw prediction scores.',
    permissions: ['Full Candidate PII', 'Live HD Camera Feed', '94.2% Raw Score Precision', 'Real-time Fraud Escalations'],
  },
  {
    id: 'guest_demo',
    role: 'guest_demo',
    intent: 'demo_walkthrough',
    context: 'exam_in_progress',
    title: 'Public Demo / Guest',
    shortLabel: 'Public Demo',
    icon: '🟣',
    tag: 'Zero-PII Privacy Safe',
    tone: 'purple',
    targetRoute: '/verify',
    description: 'Privacy-preserving demo walkthrough. Zero candidate PII leakage: masked names (R*** S***), blurred photos, and bucketed scores.',
    permissions: ['Masked Names (R*** S***)', 'Masked Roll (***0042)', 'Blurred Admit Photos', 'Bucketed Confidence (High/Med/Low)'],
  },
  {
    id: 'auditor',
    role: 'auditor',
    intent: 'post_exam_review',
    context: 'exam_closed',
    title: 'Auditor / Compliance',
    shortLabel: 'Auditor',
    icon: '🔵',
    tag: 'Post-Exam Audit',
    tone: 'blue',
    targetRoute: '/audit',
    description: 'Post-exam compliance review. Full historical candidate records and fraud flags; live gate camera streams disabled.',
    permissions: ['Full Candidate Records', 'Historical Audit Ledger', 'Discrepancy Investigation', 'Camera Feed Disabled (Privacy Safe)'],
  },
  {
    id: 'mismatched',
    role: 'invigilator',
    intent: 'post_exam_review',
    context: 'exam_in_progress',
    title: 'Context Mismatch Test',
    shortLabel: 'Mismatch Test',
    icon: '⚠️',
    tag: 'Defensive Minimization',
    tone: 'amber',
    targetRoute: '/verify',
    description: 'Simulates unauthorized post-exam access during active exam. System automatically activates defensive data minimization.',
    permissions: ['Defensive Minimization', 'Masked PII + Reason Shown', 'Camera Stream Hidden', 'Mismatch Alert Logged'],
  },
]

const DEFAULT_PERSONA = PERSONAS[0]

function readStoredContext() {
  try {
    const raw = localStorage.getItem('examverify_privacy_context')
    if (!raw) return { role: DEFAULT_PERSONA.role, intent: DEFAULT_PERSONA.intent, context: DEFAULT_PERSONA.context, screen: 'home' }
    const parsed = JSON.parse(raw)
    return {
      role: parsed.role || DEFAULT_PERSONA.role,
      intent: parsed.intent || DEFAULT_PERSONA.intent,
      context: parsed.context || DEFAULT_PERSONA.context,
      screen: parsed.screen || 'home',
    }
  } catch {
    return { role: DEFAULT_PERSONA.role, intent: DEFAULT_PERSONA.intent, context: DEFAULT_PERSONA.context, screen: 'home' }
  }
}

export function PrivacyProvider({ children }) {
  const [context, setContext] = useState(readStoredContext)
  const [decision, setDecision] = useState(null)
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false)

  const activePersona = useMemo(() => {
    const matched = PERSONAS.find(
      (p) => p.role === context.role && p.intent === context.intent && p.context === context.context
    )
    if (matched) return matched
    return PERSONAS.find((p) => p.role === context.role) || DEFAULT_PERSONA
  }, [context])

  const selectPersona = async (personaId, screen = context.screen || 'verify') => {
    const p = PERSONAS.find((item) => item.id === personaId) || DEFAULT_PERSONA
    const nextContext = {
      role: p.role,
      intent: p.intent,
      context: p.context,
      screen,
    }
    localStorage.setItem('examverify_privacy_context', JSON.stringify(nextContext))
    setContext(nextContext)

    try {
      const response = await api('/context/session', {
        method: 'POST',
        screen,
        headers: {
          'X-Viewer-Role': p.role,
          'X-Viewer-Intent': p.intent,
          'X-Viewer-Context': p.context,
          'X-Viewer-Screen': screen,
        },
        body: JSON.stringify(nextContext),
      })
      setDecision(response.visibility_profile || response.privacy_decision)
    } catch {
      // Fallback
    }
  }

  useEffect(() => {
    selectPersona(activePersona.id, context.screen || 'home')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(() => ({
    context,
    decision,
    activePersona,
    personas: PERSONAS,
    selectPersona,
    isDiffModalOpen,
    setIsDiffModalOpen,
    isRulesModalOpen,
    setIsRulesModalOpen,
  }), [context, decision, activePersona, isDiffModalOpen, isRulesModalOpen])

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider')
  return ctx
}
