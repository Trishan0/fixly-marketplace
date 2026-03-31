const maskPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '*** *** ***';
  const first3 = digits.slice(0, 3);
  const last3 = digits.slice(-3);
  return `${first3} *** *${last3}`;
};

const canRevealPhone = (job, requesterId) => {
  return (
    job.assigned_worker_id !== null &&
    (requesterId === job.customer_id || requesterId === job.assigned_worker_id)
  );
};

module.exports = { maskPhone, canRevealPhone };
