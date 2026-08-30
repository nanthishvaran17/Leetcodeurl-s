import asyncio
import httpx

async def test():
    query = """
    query {
      user1: matchedUser(username: "nanthishvaran17") {
        username
      }
      user2: matchedUser(username: "Eniyavan_r") {
        username
      }
    }
    """
    async with httpx.AsyncClient() as client:
        r = await client.post("https://leetcode.com/graphql", json={"query": query})
        print(r.status_code)
        print(r.text)

asyncio.run(test())
