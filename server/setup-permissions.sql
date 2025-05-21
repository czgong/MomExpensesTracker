-- Enable row level security for the people table
alter table people enable row level security;

-- Create a policy that allows all operations for authenticated and anonymous users
create policy "Allow public access to people"
    on people
    for all
    using (true)
    with check (true);

-- Grant necessary permissions to the anonymous role
grant all on people to anon;
grant usage on sequence people_id_seq to anon;
