const { VALID_ORDER_STATUSES, VALID_FLIGHT_STATUSES } = require('../config');

function validateFlight(req, res, next) {
  const { flightNo, airline, departure, arrival, departureTime, arrivalTime, price, totalSeats, aircraft } = req.body;
  const errors = [];

  if (!flightNo || typeof flightNo !== 'string' || flightNo.trim().length === 0) {
    errors.push('航班号不能为空');
  }
  if (!airline || typeof airline !== 'string' || airline.trim().length === 0) {
    errors.push('航空公司不能为空');
  }
  if (!departure || typeof departure !== 'string' || departure.trim().length === 0) {
    errors.push('出发城市不能为空');
  }
  if (!arrival || typeof arrival !== 'string' || arrival.trim().length === 0) {
    errors.push('到达城市不能为空');
  }
  if (!departureTime || !arrivalTime) {
    errors.push('出发和到达时间不能为空');
  }
  if (departureTime && arrivalTime && new Date(arrivalTime) <= new Date(departureTime)) {
    errors.push('到达时间必须晚于出发时间');
  }
  if (price === undefined || typeof price !== 'number' || price <= 0) {
    errors.push('票价必须为正数');
  }
  if (totalSeats === undefined || typeof totalSeats !== 'number' || !Number.isInteger(totalSeats) || totalSeats <= 0) {
    errors.push('座位数必须为正整数');
  }
  if (!aircraft || typeof aircraft !== 'string' || aircraft.trim().length === 0) {
    errors.push('机型不能为空');
  }
  if (req.body.status && !VALID_FLIGHT_STATUSES.includes(req.body.status)) {
    errors.push(`航班状态无效，可选值: ${VALID_FLIGHT_STATUSES.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join('; ') });
  }
  next();
}

function validateOrderStatus(req, res, next) {
  const { status } = req.body;
  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: `订单状态无效，可选值: ${VALID_ORDER_STATUSES.join(', ')}` });
  }
  next();
}

module.exports = { validateFlight, validateOrderStatus };
