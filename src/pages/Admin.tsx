export function Admin() {
  return (
    <section className="card">
      <h1>Admin</h1>
      <p>Provisionamento é feito fora do site via script local.</p>
      <ol>
        <li>Atualize o arquivo local de input com usuário/role/senha.</li>
        <li>Execute <code>npm run provision</code>.</li>
        <li>Revise e comite apenas <code>public/users.json</code>.</li>
      </ol>
    </section>
  );
}
