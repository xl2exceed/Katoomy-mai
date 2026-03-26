-- Allow staff members to update bookings assigned to them
CREATE POLICY "Staff can update their own bookings"
ON public.bookings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.user_id = auth.uid()
      AND staff.id = bookings.staff_id
  )
);
