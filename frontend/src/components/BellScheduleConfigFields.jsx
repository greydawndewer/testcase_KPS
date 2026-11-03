import { Input } from './ui/input';
import { Label } from './ui/label';

const BellScheduleConfigFields = ({
  value,
  onChange,
  prefix,
  periodDurationMinutes,
  includeBreak = false,
}) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <div className="space-y-2">
      <Label htmlFor={`${prefix}-start`}>First period starts</Label>
      <Input
        id={`${prefix}-start`}
        type="time"
        step={300}
        min="00:00"
        max="23:55"
        value={value.startTime}
        onChange={event => onChange('startTime', event.target.value)}
        required
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${prefix}-dismissal`}>Dismissal</Label>
      <Input
        id={`${prefix}-dismissal`}
        type="time"
        step={300}
        min="00:00"
        max="23:55"
        value={value.dismissalTime}
        onChange={event => onChange('dismissalTime', event.target.value)}
        required
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${prefix}-duration`}>Calculated period duration</Label>
      <Input
        id={`${prefix}-duration`}
        value={periodDurationMinutes ? `${periodDurationMinutes} minutes` : 'Not valid'}
        readOnly
        aria-live="polite"
      />
    </div>
    {includeBreak && (
      <>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-break-after`}>Break after period</Label>
          <select
            id={`${prefix}-break-after`}
            className="period-config-select"
            value={value.breakAfterPeriod}
            onChange={event => onChange('breakAfterPeriod', Number(event.target.value))}
          >
            <option value={3}>Period 3</option>
            <option value={4}>Period 4</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-break-duration`}>Break duration</Label>
          <Input
            id={`${prefix}-break-duration`}
            type="number"
            min={5}
            max={120}
            step={5}
            value={value.breakDurationMinutes}
            onChange={event => onChange('breakDurationMinutes', event.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${prefix}-timezone`}>School timezone (IANA)</Label>
          <Input
            id={`${prefix}-timezone`}
            value={value.schoolTimezone}
            onChange={event => onChange('schoolTimezone', event.target.value)}
            placeholder="Asia/Kolkata"
            required
          />
        </div>
      </>
    )}
  </div>
);

export default BellScheduleConfigFields;
