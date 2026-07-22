'use client'

type MonthOption = {
  value: string
  label: string
}

type MonthlyReportActionsProps = {
  months: MonthOption[]
}

export function MonthlyReportActions({ months }: MonthlyReportActionsProps) {
  const defaultMonth = months[0]?.value || ''

  return (
    <form action="/api/merchant-reports/monthly" method="get" style={actionsStyle}>
      <label style={labelStyle}>
        <span style={labelTextStyle}>Mes</span>
        <select name="month" defaultValue={defaultMonth} style={selectStyle}>
          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" style={buttonStyle}>
        Descargar informe mensual
      </button>
    </form>
  )
}

const actionsStyle = {
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
} satisfies React.CSSProperties

const labelStyle = {
  display: 'grid',
  gap: 6,
} satisfies React.CSSProperties

const labelTextStyle = {
  color: '#5b6275',
  fontSize: 13,
  fontWeight: 800,
} satisfies React.CSSProperties

const selectStyle = {
  minHeight: 44,
  minWidth: 170,
  padding: '10px 12px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  fontWeight: 700,
} satisfies React.CSSProperties

const buttonStyle = {
  minHeight: 44,
  padding: '10px 14px',
  border: '1px solid #635bff',
  borderRadius: 8,
  background: '#635bff',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
} satisfies React.CSSProperties
